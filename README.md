# NextjsKickstart

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

This frontend leverages the [shadcn/ui](https://github.com/shadcn/ui) component library for styling and UI primitives.

## Prerequisites

- Node.js v14 or later  
- npm, yarn, or pnpm  
- Go 1.18+ (for the backend service)

## Installation

1. Clone the frontend repo (if you haven't already):

   ```bash
   git clone <your-frontend-repo-url>
   cd nextjs-shadcn-frontend-src
   ```

2. Clone and start the Go backend:

   ```bash
   git clone https://github.com/johngai19/GoGinKickstart.git ../GoGinKickstart
   cd ../GoGinKickstart
   go run main.go
   ```

   By default the backend will listen on http://localhost:8080.

3. Go back to the frontend folder and install dependencies:

   ```bash
   cd ../nextjs-shadcn-frontend-src
   pnpm install
   ```

## Getting Started

Make sure the Go backend is running on port 8080, then start the Next.js dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser. The frontend will proxy `/api/*` calls to the Go backend at `http://localhost:8080/api/v1/...`.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
