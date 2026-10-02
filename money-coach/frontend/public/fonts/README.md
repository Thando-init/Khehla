# Khehla frontend typefaces

The frontend self-hosts these WOFF2 subsets so page views do not request font files from a third-party host at runtime:

- **Fraunces** — warm old-style display serif designed by Undercase Type, Phaedra Charles, and Flavia Zimbardi. Used for brand and key editorial headings. SIL Open Font License 1.1; see `Fraunces-OFL.txt`.
- **Manrope** — variable sans-serif designed by Mikhail Sharanda. Used for interface text and financial figures. SIL Open Font License 1.1; see `Manrope-OFL.txt`.

Font specimens and upstream sources:

- [Fraunces on Google Fonts](https://fonts.google.com/specimen/Fraunces)
- [Fraunces source repository](https://github.com/undercasetype/Fraunces)
- [Manrope on Google Fonts](https://fonts.google.com/specimen/Manrope)
- [Google Fonts repository](https://github.com/google/fonts/tree/main/ofl/manrope)

Latin and Latin Extended subsets are included; CSS `unicode-range` routes glyphs to the appropriate local file. Font files were retrieved from Google Fonts’ `fonts.gstatic.com` static asset host.
