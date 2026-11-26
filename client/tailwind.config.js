/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        reddit: {
          orange: '#FF4500',
          orangeHover: '#D93A00',
          blue: '#0079D3',
          blueHover: '#0060A8',
          canvas: '#DAE0E6',
          surface: '#FFFFFF',
          border: '#EDEFF1',
          muted: '#787C7E',
          ink: '#1C1C1C',
        },
      },
    },
  },
  plugins: [],
};
