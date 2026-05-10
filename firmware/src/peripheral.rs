//! Peripheral (RIGHT half) firmware.
//!
//! Same mixed-diode situation as central: BidirectionalMatrix lets the
//! main keys (anode-on-/COL) and thumb keys (anode-on-/ROW) coexist on
//! one physical pin set.

#![no_std]
#![no_main]

mod keymap;
mod scan_map;

use defmt::{info, unwrap};
use defmt_rtt as _;
use embassy_executor::Spawner;
use embassy_nrf::gpio::{Flex, Level, Output, OutputDrive, Pull};
use embassy_nrf::mode::Async;
use embassy_nrf::peripherals::RNG;
use embassy_nrf::peripherals::USBD;
use embassy_nrf::{bind_interrupts, rng, usb};
use nrf_mpsl::Flash;
use nrf_sdc::mpsl::MultiprotocolServiceLayer;
use nrf_sdc::{self as sdc, mpsl};
use panic_probe as _;
use rand_chacha::ChaCha12Rng;
use rand_core::SeedableRng;
use rmk::ble::build_ble_stack;
use rmk::channel::EVENT_CHANNEL;
use rmk::config::StorageConfig;
use rmk::debounce::default_debouncer::DefaultDebouncer;
use rmk::futures::future::join;
use rmk::matrix::bidirectional_matrix::BidirectionalMatrix;
use rmk::split::peripheral::run_rmk_split_peripheral;
use rmk::storage::new_storage_for_split_peripheral;
use rmk::{HostResources, run_devices};
use static_cell::StaticCell;

use crate::scan_map::{COL_LOCAL, PIN_NUM, ROW_LOCAL, right_scan_map};

bind_interrupts!(struct Irqs {
    USBD => usb::InterruptHandler<USBD>;
    RNG => rng::InterruptHandler<RNG>;
    EGU0_SWI0 => nrf_sdc::mpsl::LowPrioInterruptHandler;
    CLOCK_POWER => nrf_sdc::mpsl::ClockInterruptHandler, usb::vbus_detect::InterruptHandler;
    RADIO => nrf_sdc::mpsl::HighPrioInterruptHandler;
    TIMER0 => nrf_sdc::mpsl::HighPrioInterruptHandler;
    RTC0 => nrf_sdc::mpsl::HighPrioInterruptHandler;
});

#[embassy_executor::task]
async fn mpsl_task(mpsl: &'static MultiprotocolServiceLayer<'static>) -> ! {
    mpsl.run().await
}

const L2CAP_TXQ: u8 = 3;
const L2CAP_RXQ: u8 = 3;
const L2CAP_MTU: usize = 251;

fn build_sdc<'d, const N: usize>(
    p: nrf_sdc::Peripherals<'d>,
    rng: &'d mut rng::Rng<Async>,
    mpsl: &'d MultiprotocolServiceLayer,
    mem: &'d mut sdc::Mem<N>,
) -> Result<nrf_sdc::SoftdeviceController<'d>, nrf_sdc::Error> {
    sdc::Builder::new()?
        .support_adv()?
        .support_peripheral()?
        .support_dle_peripheral()?
        .support_phy_update_peripheral()?
        .support_le_2m_phy()?
        .peripheral_count(1)?
        .buffer_cfg(L2CAP_MTU as u16, L2CAP_MTU as u16, L2CAP_TXQ, L2CAP_RXQ)?
        .build(p, rng, mpsl, mem)
}

fn ble_addr() -> [u8; 6] {
    let ficr = embassy_nrf::pac::FICR;
    let high = u64::from(ficr.deviceid(1).read());
    let addr = (high << 32) | u64::from(ficr.deviceid(0).read());
    let addr = addr | 0x0000_c000_0000_0000;
    unwrap!(addr.to_le_bytes()[..6].try_into())
}

#[embassy_executor::main]
async fn main(spawner: Spawner) {
    info!("Hello kobitokey-o-oyayubi peripheral (BidirectionalMatrix)!");

    let mut nrf_config = embassy_nrf::config::Config::default();
    nrf_config.dcdc.reg0_voltage = Some(embassy_nrf::config::Reg0Voltage::_3V3);
    nrf_config.dcdc.reg0 = true;
    nrf_config.dcdc.reg1 = true;
    let p = embassy_nrf::init(nrf_config);

    // Boot LED indicator (common-anode → LOW = on).
    let _boot_led = Output::new(p.P0_30, Level::Low, OutputDrive::Standard);

    let mpsl_p = mpsl::Peripherals::new(p.RTC0, p.TIMER0, p.TEMP, p.PPI_CH19, p.PPI_CH30, p.PPI_CH31);
    let lfclk_cfg = mpsl::raw::mpsl_clock_lfclk_cfg_t {
        source: mpsl::raw::MPSL_CLOCK_LF_SRC_RC as u8,
        rc_ctiv: mpsl::raw::MPSL_RECOMMENDED_RC_CTIV as u8,
        rc_temp_ctiv: mpsl::raw::MPSL_RECOMMENDED_RC_TEMP_CTIV as u8,
        accuracy_ppm: mpsl::raw::MPSL_DEFAULT_CLOCK_ACCURACY_PPM as u16,
        skip_wait_lfclk_started: mpsl::raw::MPSL_DEFAULT_SKIP_WAIT_LFCLK_STARTED != 0,
    };
    static MPSL: StaticCell<MultiprotocolServiceLayer> = StaticCell::new();
    static SESSION_MEM: StaticCell<mpsl::SessionMem<1>> = StaticCell::new();
    let mpsl = MPSL.init(unwrap!(mpsl::MultiprotocolServiceLayer::with_timeslots(
        mpsl_p,
        Irqs,
        lfclk_cfg,
        SESSION_MEM.init(mpsl::SessionMem::new())
    )));
    spawner.must_spawn(mpsl_task(mpsl));
    let sdc_p = sdc::Peripherals::new(
        p.PPI_CH17, p.PPI_CH18, p.PPI_CH20, p.PPI_CH21, p.PPI_CH22, p.PPI_CH23, p.PPI_CH24, p.PPI_CH25, p.PPI_CH26,
        p.PPI_CH27, p.PPI_CH28, p.PPI_CH29,
    );
    let mut rng = rng::Rng::new(p.RNG, Irqs);
    let mut rng_generator = ChaCha12Rng::from_rng(&mut rng).unwrap();
    let mut sdc_mem = sdc::Mem::<4624>::new();
    let sdc = unwrap!(build_sdc(sdc_p, &mut rng, mpsl, &mut sdc_mem));
    let mut resources = HostResources::new();
    let stack = build_ble_stack(sdc, ble_addr(), &mut rng_generator, &mut resources).await;

    // Pin order matches keymap col indexing for the right half:
    //   col 0 (= unified col 5, inner index Y) → /COL0 wire (P1_12)
    //   col 4 (= unified col 9, outer pinky P) → /COL4 wire (P0_10)
    //
    // See central.rs for why we must initialize every pin as a pull-down
    // input before handing them to BidirectionalMatrix.
    let mut pins: [Flex<'static>; PIN_NUM] = [
        Flex::new(p.P0_29), // ROW0
        Flex::new(p.P0_04), // ROW1
        Flex::new(p.P0_05), // ROW2
        Flex::new(p.P1_11), // ROW3 (thumb)
        Flex::new(p.P1_12), // /COL0 wire (Y inner-index col)
        Flex::new(p.P1_13), // /COL1 wire
        Flex::new(p.P1_14), // /COL2 wire
        Flex::new(p.P1_15), // /COL3 wire
        Flex::new(p.P0_10), // /COL4 wire (P pinky col)
    ];
    for pin in pins.iter_mut() {
        pin.set_as_input(Pull::Down);
    }

    // Storage for the peripheral half (small reservation; nothing
    // user-meaningful is persisted on this side, but RMK requires a
    // backing store for split BLE bonds).
    let storage_config = StorageConfig {
        start_addr: 0,
        num_sectors: 2,
        ..Default::default()
    };
    let flash = Flash::take(mpsl, p.NVMC);
    let mut storage = new_storage_for_split_peripheral(flash, storage_config).await;

    let debouncer = DefaultDebouncer::<ROW_LOCAL, COL_LOCAL>::new();
    let mut matrix = BidirectionalMatrix::<_, _, PIN_NUM, ROW_LOCAL, COL_LOCAL>::new(pins, debouncer, right_scan_map());

    info!("kobitokey-o-oyayubi peripheral up — entering run loop");

    join(
        run_devices!((matrix) => EVENT_CHANNEL),
        run_rmk_split_peripheral(0, &stack, &mut storage),
    )
    .await;
}
