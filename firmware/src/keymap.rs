//! Hand-rolled keymap for the kobitokey-o-oyayubi mixed-diode build.
//!
//! Layout matches `keyboard.toml` (4 rows × 10 cols × 4 layers, unified):
//!   row 0..2: QWERTY main keys
//!   row 3   : thumb diagnostic — A B C D / E F G H, phantom slots at
//!             (3, 0) / (3, 9) where the PCB has no switch on /COL4.
//!
//! Once every physical key is verified the row 3 letters can be swapped
//! back to LCtrl / LAlt / MO(2) / Space | Enter / MO(1) / RShift / RAlt.

use rmk::types::action::KeyAction;
use rmk::{a, k};

#[allow(dead_code)]
pub const ROW: usize = 4;
#[allow(dead_code)]
pub const COL: usize = 10;
#[allow(dead_code)]
pub const NUM_LAYER: usize = 4;

#[allow(dead_code)]
#[rustfmt::skip]
pub const fn get_default_keymap() -> [[[KeyAction; COL]; ROW]; NUM_LAYER] {
    [
        // Layer 0: QWERTY base + ABCD/EFGH thumb diagnostic
        [
            [k!(Q),     k!(W),     k!(E),     k!(R),     k!(T),         k!(Y),     k!(U),     k!(I),     k!(O),     k!(P)        ],
            [k!(A),     k!(S),     k!(D),     k!(F),     k!(G),         k!(H),     k!(J),     k!(K),     k!(L),     k!(Semicolon)],
            [k!(Z),     k!(X),     k!(C),     k!(V),     k!(B),         k!(N),     k!(M),     k!(Comma), k!(Dot),   k!(Slash)    ],
            [a!(No),    k!(A),     k!(B),     k!(C),     k!(D),         k!(E),     k!(F),     k!(G),     k!(H),     a!(No)       ],
        ],
        // Layer 1: numbers + brackets
        [
            [k!(Kc1),   k!(Kc2),   k!(Kc3),   k!(Kc4),   k!(Kc5),       k!(Kc6),   k!(Kc7),   k!(Kc8),   k!(Kc9),   k!(Kc0)      ],
            [k!(Minus), k!(Equal), k!(LeftBracket), k!(RightBracket), k!(Backslash), k!(Grave), k!(Quote), a!(No),  a!(No),    a!(No)       ],
            [a!(No),    a!(No),    a!(No),    a!(No),    a!(No),        a!(No),    a!(No),    a!(No),    a!(No),    a!(No)       ],
            [a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent)],
        ],
        // Layer 2: F-keys + navigation
        [
            [k!(F1),    k!(F2),    k!(F3),    k!(F4),    k!(F5),        k!(F6),    k!(F7),    k!(F8),    k!(F9),    k!(F10)      ],
            [k!(Home),  k!(PageUp),k!(PageDown),k!(End), k!(Insert),    k!(Left),  k!(Down),  k!(Up),    k!(Right), k!(Delete)   ],
            [k!(F11),   k!(F12),   a!(No),    a!(No),    a!(No),        a!(No),    a!(No),    a!(No),    a!(No),    a!(No)       ],
            [a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent)],
        ],
        // Layer 3: reserved
        [
            [a!(No),    a!(No),    a!(No),    a!(No),    a!(No),        a!(No),    a!(No),    a!(No),    a!(No),    a!(No)       ],
            [a!(No),    a!(No),    a!(No),    a!(No),    a!(No),        a!(No),    a!(No),    a!(No),    a!(No),    a!(No)       ],
            [a!(No),    a!(No),    a!(No),    a!(No),    a!(No),        a!(No),    a!(No),    a!(No),    a!(No),    a!(No)       ],
            [a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent), a!(Transparent)],
        ],
    ]
}
