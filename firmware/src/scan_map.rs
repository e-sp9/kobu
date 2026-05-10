//! Scan maps for the BidirectionalMatrix.
//!
//! On the assembled boards we have:
//!   - main-unit diodes: anode physically on /COL  (col2row direction)
//!   - thumb-unit diodes: anode physically on /ROW  (row2col direction)
//!
//! `BidirectionalMatrix` lets us pick `(in_pin, out_pin)` per (row, col)
//! cell, so each cell drives the side that holds its diode anode and
//! reads the cathode side. The pin array is shared (9 FlexPins) and the
//! scan_map below specifies which two pins to use per logical key.
//!
//! Pin index layout (same on both halves, only the col_pin order
//! differs between left and right because the physical PCB column
//! ordering is mirrored):
//!     0 = ROW0  (P0_29 / D3)
//!     1 = ROW1  (P0_04 / D4)
//!     2 = ROW2  (P0_05 / D5)
//!     3 = ROW3  (P1_11 / D6, thumb-only, local)
//!     4..8     = the 5 col pins, in keymap-col order (see central /
//!                 peripheral main for the actual ordering).
//!
//! For the LEFT half (central):
//!     pin 4 = P0_10 (/COL4 wire) — keymap col 0 (outer pinky / Q)
//!     pin 5 = P1_15 (/COL3 wire) — keymap col 1 (W)
//!     pin 6 = P1_14 (/COL2 wire) — keymap col 2 (E)
//!     pin 7 = P1_13 (/COL1 wire) — keymap col 3 (R)
//!     pin 8 = P1_12 (/COL0 wire) — keymap col 4 (inner index / T)
//!
//! For the RIGHT half (peripheral):
//!     pin 4 = P1_12 (/COL0 wire) — local col 0 (inner index / Y)
//!     pin 5 = P1_13 (/COL1 wire) — local col 1 (U)
//!     pin 6 = P1_14 (/COL2 wire) — local col 2 (I)
//!     pin 7 = P1_15 (/COL3 wire) — local col 3 (O)
//!     pin 8 = P0_10 (/COL4 wire) — local col 4 (outer pinky / P)
//!
//! With those pin orders, the scan_map for both halves is identical
//! because main keys always live on rows 0..2 (drive col, read row)
//! and thumb keys always live on row 3 (drive row, read col), and the
//! phantom (no PCB switch) is always at the pinky col.

use rmk::matrix::bidirectional_matrix::ScanLocation::{self, Ignore, Pins};

pub const ROW_LOCAL: usize = 4;
pub const COL_LOCAL: usize = 5;
pub const PIN_NUM: usize = 9;

const ROW0: usize = 0;
const ROW1: usize = 1;
const ROW2: usize = 2;
const ROW3: usize = 3;
const C0: usize = 4;
const C1: usize = 5;
const C2: usize = 6;
const C3: usize = 7;
const C4: usize = 8;

/// LEFT half scan map.
///
/// Pinky column lives at local col 0, so the row-3 phantom is at (3, 0).
#[allow(dead_code)]
pub const fn left_scan_map() -> [[ScanLocation; COL_LOCAL]; ROW_LOCAL] {
    [
        // Row 0: Q W E R T  (main keys, anode-on-/COL → drive col, read row0)
        [Pins(ROW0, C0), Pins(ROW0, C1), Pins(ROW0, C2), Pins(ROW0, C3), Pins(ROW0, C4)],
        // Row 1: A S D F G
        [Pins(ROW1, C0), Pins(ROW1, C1), Pins(ROW1, C2), Pins(ROW1, C3), Pins(ROW1, C4)],
        // Row 2: Z X C V B
        [Pins(ROW2, C0), Pins(ROW2, C1), Pins(ROW2, C2), Pins(ROW2, C3), Pins(ROW2, C4)],
        // Row 3: pinky has no thumb switch; thumbs live on cols 1..4
        // (anode-on-/ROW → drive row3, read col).
        [Ignore,         Pins(C1, ROW3), Pins(C2, ROW3), Pins(C3, ROW3), Pins(C4, ROW3)],
    ]
}

/// RIGHT half scan map.
///
/// Pinky column lives at local col 4 (outermost = highest col index),
/// so the row-3 phantom is at (3, 4) and thumbs are at cols 0..3.
#[allow(dead_code)]
pub const fn right_scan_map() -> [[ScanLocation; COL_LOCAL]; ROW_LOCAL] {
    [
        // Row 0: Y U I O P  (main keys)
        [Pins(ROW0, C0), Pins(ROW0, C1), Pins(ROW0, C2), Pins(ROW0, C3), Pins(ROW0, C4)],
        // Row 1: H J K L ;
        [Pins(ROW1, C0), Pins(ROW1, C1), Pins(ROW1, C2), Pins(ROW1, C3), Pins(ROW1, C4)],
        // Row 2: N M , . /
        [Pins(ROW2, C0), Pins(ROW2, C1), Pins(ROW2, C2), Pins(ROW2, C3), Pins(ROW2, C4)],
        // Row 3: thumbs at cols 0..3, pinky col 4 has no switch
        [Pins(C0, ROW3), Pins(C1, ROW3), Pins(C2, ROW3), Pins(C3, ROW3), Ignore        ],
    ]
}
