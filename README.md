# GymSight 💪

GymSight is a web application designed to enhance your workout experience by providing real-time feedback on exercise form using AI-powered video analysis. Select an exercise, record yourself performing it, and receive instant corrective guidance to improve technique and prevent injuries.

## ✨ Features

* **Real-time Exercise Form Analysis:** Get immediate feedback on your posture and movement.
* **AI-Powered Video Processing:** Leverages advanced AI models to understand exercise execution.
* **Corrective Guidance:** Receive actionable tips to improve your form.
* **User-Friendly Interface:** Easily select exercises and view feedback.

## 🚀 Technology Stack

GymSight is built with a modern and efficient technology stack:

* **Frontend Framework:** [Next.js](https://nextjs.org/) - Handles routing, server-side rendering, and API endpoints.
* **UI Components:** [Shadcn UI](https://ui.shadcn.com/) - Provides accessible and customizable UI components built on Tailwind CSS.
* **AI/ML Abstraction:** [Genkit](https://firebase.google.com/docs/genkit) - Simplifies interaction with foundation models through a clean abstraction layer.
* **Foundation Model:** [Google AI Gemini 2.0 Flash](https://deepmind.google/technologies/gemini/) - Powers the core video analysis and feedback generation (accessed via the `@genkit-ai/googleai` plugin).

## 🏗️ Project Structure

Here's a brief overview of the key directories and files:

.
├── src/
│   ├── app/
│   │   └── page.tsx        # Main application component (camera, selection, AI integration)
│   ├── components/
│   │   └── ui/             # Reusable Shadcn UI components (Button, Select, Card, etc.)
│   ├── ai/
│   │   ├── ai-instance.ts  # Genkit instance configuration and initialization
│   │   └── flows/
│   │       └── analyze-exercise-form.ts # Defines the Genkit flow for exercise analysis
│   └── ...                 # Other source files
├── public/                 # Static assets
├── next.config.ts          # Next.js configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Project dependencies and scripts 1 
└── README.md               # This file   


## 🛠️ Getting Started

Follow these steps to get GymSight running locally:

**1. Prerequisites:**

* Node.js (Version X.X.X or higher recommended - *adjust as needed*)
* npm, yarn, or pnpm
* A Google AI API Key (for Gemini access)

**2. Clone the Repository:**

```bash
git clone [https://github.com/your-username/gymsight.git](https://github.com/your-username/gymsight.git) # Replace with your repo URL
cd gymsight

npm install
# or
yarn install
# or
pnpm install

# .env.local
GOOGLE_AI_API_KEY=YOUR_API_KEY_HERE

npm run dev
# or
yarn dev
# or
pnpm dev
