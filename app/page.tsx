import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-6">
        <h1 className="text-5xl font-bold text-gray-900">
          Freelance Dashboard
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Track expenses, send invoices, and see profit — without complex accounting.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/auth/signup"
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
          >
            Get Started
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-white text-indigo-600 rounded-lg border border-indigo-600 hover:bg-indigo-50 transition"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

