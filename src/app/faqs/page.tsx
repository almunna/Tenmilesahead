// app/faqs/page.tsx
export default function FAQs() {
  return (
    <div className="container py-10">
      <h1 className="text-3xl font-bold mb-6">Frequently Asked Questions</h1>
      <div className="space-y-4">
        {FAQS.map((item, i) => (
          <details key={i} className="card">
            <summary className="cursor-pointer font-semibold">{item.q}</summary>
            <div className="mt-2 text-slate-700">{item.a}</div>
          </details>
        ))}
      </div>
    </div>
  );
}

const FAQS = [
  {
    q: "What is Ten Miles Ahead?",
    a: "Ten Miles Ahead is a dynamic travel journal app designed for modern explorers to log their trips, create photo stories, and share their adventures with a global community.",
  },
  {
    q: "How do I log a new trip?",
    a: "Click on the 'Add Trip' button from your dashboard, fill in the details like destination, dates, and description, and save it.",
  },
  {
    q: "Can I add photos to my trips?",
    a: "Absolutely! Upload your favorite pictures and add notes to capture every memory.",
  },
  {
    q: "How do I share my trip with friends and family?",
    a: "Generate a private, shareable link—anyone with the link can view, even without an account.",
  },
  {
    q: "What are 'Global Reviews'?",
    a: "Explore ratings and reviews from other travelers on accommodations, restaurants, and activities worldwide.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. We use robust authentication and database security to keep your travel memories safe.",
  },
  {
    q: "Can I edit my trip details after saving?",
    a: "Of course! You can edit any trip details, photos, or reviews later.",
  },
  {
    q: "Do I need an account to use Ten Miles Ahead?",
    a: "You can browse landing/FAQs/Tutorials without an account, but you must log in to create and manage trips.",
  },
  {
    q: "What devices are compatible?",
    a: "Ten Miles Ahead works beautifully across desktops, tablets, and mobile devices.",
  },
  { q: "How do I contact support?", a: "Email us at admin@tenmilesahead.com." },
];
