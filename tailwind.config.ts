import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 토스 스타일 팔레트
        bg: {
          DEFAULT: "#ffffff",        // 깔끔한 흰색
          subtle: "#f5f7fa",         // 카드·섹션 라이트 그레이
          muted: "#f9fafb",
        },
        line: {
          DEFAULT: "#e1e6ec",
          strong: "#c5ccd5",
        },
        ink: {
          DEFAULT: "#0f1924",        // 진한 네이비-블랙
          secondary: "#4a5562",
          tertiary: "#8a95a3",
          quaternary: "#b4bdc8",
        },
        accent: {
          DEFAULT: "#1b3a6f",        // 시그니처 깊은 네이비
          dark: "#0f2954",           // 더 진한 네이비 (hover)
          ink: "#ffffff",            // 네이비 위 흰 텍스트
          light: "#dbe5f5",
          subtle: "#f3f6fb",
        },
        hot: "#e8463c",
        danger: "#dc2626",
        success: "#15803d",
        warning: "#d97706",
      },
      fontFamily: {
        sans: [
          "Pretendard Variable",
          "Pretendard",
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Roboto",
          "Helvetica Neue",
          "sans-serif",
        ],
      },
      borderRadius: {
        DEFAULT: "8px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
      },
      fontSize: {
        // 토스 위계
        "11": ["11px", { lineHeight: "16px" }],
        "13": ["13px", { lineHeight: "18px" }],
        "15": ["15px", { lineHeight: "22px" }],
        "17": ["17px", { lineHeight: "24px" }],
        "19": ["19px", { lineHeight: "26px" }],
        "22": ["22px", { lineHeight: "30px" }],
        "26": ["26px", { lineHeight: "34px" }],
        "32": ["32px", { lineHeight: "42px" }],
      },
    },
  },
  plugins: [],
};

export default config;
