import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        line: "#d9dee5",
        panel: "#f7f8fa"
      }
    }
  },
  plugins: []
};

export default config;
