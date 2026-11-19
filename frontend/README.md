# Quintegro Frontend

A React 18 application built with Vite, TypeScript 5, Material-UI 7, and React Router 5.

## Features

- **React 18** with modern hooks and features
- **TypeScript 5** for type safety
- **Vite** for fast development and building
- **Material-UI 7** for beautiful, responsive UI components
- **React Router 5** for client-side routing
- **Axios** for HTTP requests

## Project Structure

```
src/
├── components/
│   ├── MainLayout.tsx      # Main layout with header and content
│   └── HeaderComponent.tsx # Header component
├── pages/
│   └── HomePage.tsx        # Home page component
├── App.tsx                 # Main app component with routing
└── main.tsx                # Application entry point
```

## Setup and Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

4. **Preview production build:**
   ```bash
   npm run preview
   ```

## Development

The development server runs on `http://localhost:3001` and includes:

- **Hot Module Replacement (HMR)** for instant updates
- **API Proxy** to backend at `http://localhost:3000`
- **TypeScript** compilation and type checking
- **ESLint** for code quality

## Address autocomplete

The checkout field depends only on `AddressAutocompleteProvider`, so a provider
can be replaced without changing the page or form data model. It uses the open
Photon service by default. Set `VITE_ADDRESS_AUTOCOMPLETE_PROVIDER=mock` to use
the local deterministic provider, or set `VITE_PHOTON_BASE_URL` to a self-hosted
Photon endpoint. Public Photon is useful for low-volume evaluation but does not
provide an availability guarantee.

## Layout Structure

- **MainLayout**: Provides the overall page structure
  - **HeaderComponent**: Fixed header at the top
  - **Content**: Scrollable content area with max-width of 1250px
    - Horizontally centered on larger screens
    - Independent scrolling from header

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

## Dependencies

### Core
- React 18.2.0
- React DOM 18.2.0
- TypeScript 5.0.2

### Routing
- React Router DOM 5.3.4

### UI Framework
- Material-UI 7.0.0
- Material-UI Icons 7.0.0
- Emotion (React & Styled) 11.11.0

### HTTP Client
- Axios 1.6.0

### Development
- Vite 4.4.5
- ESLint 8.45.0
