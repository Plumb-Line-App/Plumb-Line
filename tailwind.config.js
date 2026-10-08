/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './js/**/*.js'],
  theme: {
    extend: {
      colors: {
        sage: { 50: '#f2f6f3', 100: '#e1ebe4', 200: '#c3d7ca', 300: '#9dbfaa', 400: '#7fae9a', 500: '#5f957f', 600: '#4f8a72', 700: '#3f6e5b', 800: '#33584a' },
        mist: { 50: '#f1f5f8', 100: '#e2eaf0', 200: '#c6d5e1', 300: '#9fb8cb', 400: '#7a9db6', 500: '#5b8aa6', 600: '#4a7290', 700: '#3d5d76' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', 'serif'],
      },
    },
  },
};
