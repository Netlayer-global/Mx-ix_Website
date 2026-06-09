/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-red': '#F20732',
                // Refined near-black neutrals (softer + richer than pure #000)
                'ink': '#0A0A0B',
                'ink-soft': '#141417',
            },
            boxShadow: {
                // Consistent 3-tier depth system (soft, layered)
                'subtle': '0 1px 2px rgba(10,10,11,0.04), 0 1px 1px rgba(10,10,11,0.03)',
                'card': '0 4px 16px -4px rgba(10,10,11,0.08), 0 2px 6px -2px rgba(10,10,11,0.05)',
                'elevated': '0 18px 40px -12px rgba(10,10,11,0.18), 0 8px 16px -8px rgba(10,10,11,0.10)',
                'red-glow': '0 8px 30px -6px rgba(242,7,50,0.35)',
            },
            fontFamily: {
                // Primary typeface for the whole site
                sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
            },
            letterSpacing: {
                // Standardized tracking tokens for mono/label text
                label: '0.15em',
                mono: '0.2em',
            },
            fontSize: {
                // Standardized label sizes (replaces ad-hoc text-[9px]/[10px]/[11px])
                'label-sm': ['0.625rem', { lineHeight: '1' }], // 10px
                'label': ['0.6875rem', { lineHeight: '1' }],   // 11px
            },
            animation: {
                'marquee': 'marquee 40s linear infinite',
                'reveal-up': 'reveal-up 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
            },
            keyframes: {
                marquee: {
                    '0%': { transform: 'translateX(0)' },
                    '100%': { transform: 'translateX(-50%)' },
                },
                'reveal-up': {
                    '0%': { opacity: '0', transform: 'translateY(24px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
        },
    },
    plugins: [],
}
