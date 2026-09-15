/**
 * ORYNVE seed — creates the owner account, default settings, shipping zones,
 * pages, homepage blocks and (optionally) a demo catalogue.
 * Idempotent: safe to run again; existing rows are kept, missing ones created.
 *
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD  — first owner login
 *   SEED_DEMO_DATA=true                     — products, collections, sample orders
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, scrypt as scryptCb } from "node:crypto";

const db = new PrismaClient();
const J = (v: unknown) => JSON.stringify(v);

async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 128 * 32768 * 8 * 2 }, (err, k) => (err ? reject(err) : resolve(k))),
  );
  return `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

const img = (id: string, w = 1600) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;

async function main() {
  // ── Owner ──────────────────────────────────────────────────────────────
  const email = (process.env.SEED_ADMIN_EMAIL ?? "owner@orynve.com").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!Immediately-2026";
  const owner = await db.user.upsert({
    where: { email },
    update: {},
    create: { email, name: "Brand owner", passwordHash: await hashPassword(password), role: "owner" },
  });
  console.log(`✔ owner ${email} ${owner.createdAt.getTime() > Date.now() - 5000 ? "(created — change the password after first login)" : "(exists)"}`);

  // ── Settings (only keys that don't exist yet) ──────────────────────────
  const settings: Record<string, unknown> = {
    brand: {},
    contact: { whatsapp: "", email: "", address: { en: "Dhaka, Bangladesh", bn: "ঢাকা, বাংলাদেশ" } },
    features: {},
    checkout: { bkashNumber: "", nagadNumber: "" },
    currency: {},
    locale: {},
    seo: {},
    site: { mode: "live" },
    ai: {},
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value: J(value) } });
  }
  console.log("✔ settings");

  // ── Shipping zones ─────────────────────────────────────────────────────
  if ((await db.shippingZone.count()) === 0) {
    await db.shippingZone.createMany({
      data: [
        { name: J({ en: "Inside Dhaka", bn: "ঢাকার ভিতরে" }), districts: J(["Dhaka"]), rate: 8000, freeAbove: 500000, etaMinDays: 1, etaMaxDays: 3, sortOrder: 0 },
        { name: J({ en: "Dhaka suburbs", bn: "ঢাকার আশপাশ" }), districts: J(["Gazipur", "Narayanganj", "Savar", "Keraniganj"]), rate: 10000, freeAbove: 600000, etaMinDays: 2, etaMaxDays: 4, sortOrder: 1 },
        { name: J({ en: "Rest of Bangladesh", bn: "সারা বাংলাদেশ" }), districts: J(["*"]), rate: 15000, freeAbove: 800000, etaMinDays: 3, etaMaxDays: 7, sortOrder: 2 },
      ],
    });
    console.log("✔ shipping zones");
  }

  // ── Pages ──────────────────────────────────────────────────────────────
  const pages: [string, Record<string, string>, Record<string, string>, string][] = [
    ["about", { en: "A different kind of presence.", bn: "একটি অন্যরকম উপস্থিতি।" }, {
      en: "We believe the most powerful thing you can wear is a sense of yourself.\n\nORYNVE is an independent menswear label from Dhaka exploring the space between refined and unconventional. Considered silhouettes. Honest materials. Pieces that feel as good as they look.\n\nWe create for those who don't need to be the loudest in the room. Clothing with intention. Style without explanation.",
      bn: "আমরা বিশ্বাস করি, আপনি যা পরতে পারেন তার মধ্যে সবচেয়ে শক্তিশালী হলো নিজের প্রতি বিশ্বাস।\n\nORYNVE ঢাকার একটি স্বাধীন মেনসওয়্যার লেবেল, যা পরিশীলিত ও অপ্রচলিতের মাঝের জায়গাটি খোঁজে। ভাবনাপূর্ণ সিলুয়েট। সৎ উপাদান। যে পোশাক দেখতে যেমন, পরতেও তেমন।\n\nআমরা তৈরি করি তাদের জন্য, যাদের ঘরে সবচেয়ে উচ্চকিত হওয়ার দরকার নেই। উদ্দেশ্য নিয়ে পোশাক। ব্যাখ্যা ছাড়া স্টাইল।",
    }, "editorial"],
    ["shipping", { en: "Delivery, considered.", bn: "ডেলিভারি, ভাবনার সাথে।" }, {
      en: "We deliver across all 64 districts of Bangladesh via trusted couriers.\n\n**Inside Dhaka:** 1–3 business days. **Outside Dhaka:** 3–7 business days.\n\nDelivery charges are shown at checkout and are free above the thresholds displayed. You'll receive your tracking code by SMS/WhatsApp when your order is handed to the courier.\n\nInternational delivery is available on request — contact us before ordering.",
      bn: "আমরা বিশ্বস্ত কুরিয়ারের মাধ্যমে বাংলাদেশের ৬৪ জেলায় ডেলিভারি করি।\n\n**ঢাকার ভিতরে:** ১–৩ কর্মদিবস। **ঢাকার বাইরে:** ৩–৭ কর্মদিবস।\n\nডেলিভারি চার্জ চেকআউটে দেখানো হয় এবং নির্দিষ্ট অঙ্কের উপরে ফ্রি। কুরিয়ারে হস্তান্তরের সময় এসএমএস/WhatsApp-এ ট্র্যাকিং কোড পাবেন।\n\nআন্তর্জাতিক ডেলিভারি অনুরোধে সম্ভব — অর্ডারের আগে যোগাযোগ করুন।",
    }, "plain"],
    ["returns", { en: "A better fit.", bn: "আরও ভালো ফিট।" }, {
      en: "If something isn't quite right, contact us within 7 days of delivery to request an exchange.\n\nItems must be unworn, unwashed, with original tags and packaging. Our team confirms eligibility and arranges pickup or drop-off. Wrong size on a first order? The exchange is on us.\n\nRefunds for prepaid orders are returned to the original bKash/Nagad/card within 7 business days after we receive the item.",
      bn: "কিছু ঠিক না লাগলে ডেলিভারির ৭ দিনের মধ্যে যোগাযোগ করে এক্সচেঞ্জের অনুরোধ করুন।\n\nপোশাক অব্যবহৃত, না-ধোয়া, আসল ট্যাগ ও প্যাকেজিংসহ হতে হবে। আমাদের টিম যোগ্যতা নিশ্চিত করে পিকআপ বা ড্রপ-অফের ব্যবস্থা করবে। প্রথম অর্ডারে সাইজ ভুল? এক্সচেঞ্জ আমাদের পক্ষ থেকে।\n\nপ্রিপেইড অর্ডারের রিফান্ড পণ্য পাওয়ার ৭ কর্মদিবসের মধ্যে মূল বিকাশ/নগদ/কার্ডে ফেরত দেওয়া হয়।",
    }, "plain"],
    ["size-guide", { en: "Find your form.", bn: "আপনার ফিট খুঁজুন।" }, {
      en: "Every product has its own measurement chart in centimetres and inches. Measure a garment you already love laid flat and compare it to the chart. Chest is the garment circumference; if you are between sizes, choose the larger one for an easier silhouette.\n\nNeed a second opinion? Ask the concierge or message us on WhatsApp with your height, weight and preferred fit.",
      bn: "প্রতিটি পোশাকের নিজস্ব মাপের চার্ট সেন্টিমিটার ও ইঞ্চিতে আছে। আপনার পছন্দের একটি পোশাক সমতলে রেখে মাপুন এবং চার্টের সাথে তুলনা করুন। বুক মাপ হলো পোশাকের পরিধি; দুই সাইজের মাঝে হলে সহজ সিলুয়েটের জন্য বড়টি বাছুন।\n\nদ্বিধায় আছেন? কনসিয়ার্জকে জিজ্ঞাসা করুন বা উচ্চতা, ওজন ও পছন্দের ফিট জানিয়ে WhatsApp-এ মেসেজ দিন।",
    }, "plain"],
    ["faq", { en: "Good questions.", bn: "ভালো প্রশ্ন।" }, {
      en: "**How do I order?** Add pieces to your bag and check out on the website (cash on delivery, bKash, Nagad or card), or send your bag to us on WhatsApp and we confirm everything with you.\n\n**Do I need an account?** No.\n\n**Is my WhatsApp order confirmed?** Our team confirms availability, delivery and payment with you directly before dispatch.\n\n**Can I change my order?** Contact us as soon as possible — we can help before dispatch.\n\n**How do I track?** Use your order number or tracking code with your mobile number on the Track order page, or ask the concierge.",
      bn: "**কীভাবে অর্ডার করব?** পিস ব্যাগে যোগ করে ওয়েবসাইটে চেকআউট করুন (ক্যাশ অন ডেলিভারি, বিকাশ, নগদ বা কার্ড), অথবা ব্যাগটি WhatsApp-এ পাঠান — আমরা সব নিশ্চিত করব।\n\n**অ্যাকাউন্ট লাগবে?** না।\n\n**WhatsApp অর্ডার নিশ্চিত?** ডিসপ্যাচের আগে আমাদের টিম স্টক, ডেলিভারি ও পেমেন্ট সরাসরি নিশ্চিত করে।\n\n**অর্ডার বদলাতে পারি?** যত দ্রুত সম্ভব যোগাযোগ করুন — ডিসপ্যাচের আগে সাহায্য করতে পারি।\n\n**কীভাবে ট্র্যাক করব?** অর্ডার ট্র্যাক পেজে অর্ডার নম্বর বা ট্র্যাকিং কোড ও মোবাইল নম্বর দিন, বা কনসিয়ার্জকে জিজ্ঞাসা করুন।",
    }, "plain"],
    ["privacy", { en: "Your privacy matters.", bn: "আপনার গোপনীয়তা গুরুত্বপূর্ণ।" }, {
      en: "We collect only what we need to fulfil your order and respond to you: name, phone, delivery address and, optionally, email. Your bag and preferences are stored on your device.\n\nWe do not sell data and we do not use third-party tracking scripts. Payment details are handled by bKash, Nagad, SSLCommerz or Stripe — we never see card numbers or PINs.\n\nThe AI concierge can only access order details after you verify your phone number, and conversations are stored to improve service. Contact us to access or delete your information.",
      bn: "আপনার অর্ডার পূরণ ও উত্তর দিতে যা দরকার শুধু তাই সংগ্রহ করি: নাম, ফোন, ডেলিভারি ঠিকানা এবং ঐচ্ছিকভাবে ইমেইল। আপনার ব্যাগ ও পছন্দ আপনার ডিভাইসে থাকে।\n\nআমরা ডেটা বিক্রি করি না এবং তৃতীয় পক্ষের ট্র্যাকিং স্ক্রিপ্ট ব্যবহার করি না। পেমেন্ট তথ্য বিকাশ, নগদ, SSLCommerz বা Stripe পরিচালনা করে — আমরা কখনো কার্ড নম্বর বা পিন দেখি না।\n\nএআই কনসিয়ার্জ শুধু ফোন নম্বর যাচাইয়ের পর অর্ডার দেখতে পারে, এবং সেবা উন্নত করতে কথোপকথন সংরক্ষিত হয়। আপনার তথ্য দেখতে বা মুছতে যোগাযোগ করুন।",
    }, "legal"],
    ["terms", { en: "A few considered details.", bn: "কিছু ভাবনাপূর্ণ বিষয়।" }, {
      en: "Prices are in Bangladeshi Taka (BDT) and include VAT where applicable. Displayed conversions to other currencies are indicative.\n\nAn order is confirmed when our team confirms it by phone/WhatsApp or when prepaid payment is verified. Availability is subject to stock at the time of confirmation.\n\nPhotography and screens may render colours slightly differently. Consult the measurement chart for fit. Exchanges follow our Returns policy.",
      bn: "দাম বাংলাদেশি টাকায় (BDT) এবং প্রযোজ্য ক্ষেত্রে ভ্যাটসহ। অন্য মুদ্রায় দেখানো রূপান্তর আনুমানিক।\n\nআমাদের টিম ফোন/WhatsApp-এ নিশ্চিত করলে বা প্রিপেইড পেমেন্ট যাচাই হলে অর্ডার নিশ্চিত হয়। স্টক নিশ্চিতকরণের সময়ের উপর নির্ভরশীল।\n\nছবি ও স্ক্রিনে রং কিছুটা আলাদা দেখাতে পারে। ফিটের জন্য মাপের চার্ট দেখুন। এক্সচেঞ্জ আমাদের রিটার্ন নীতি অনুসরণ করে।",
    }, "legal"],
  ];
  for (const [slug, title, body, template] of pages) {
    await db.page.upsert({ where: { slug }, update: {}, create: { slug, title: J(title), body: J(body), template, isPublished: true, showInFooter: slug !== "about" } });
  }
  console.log("✔ pages");

  // ── Homepage blocks ────────────────────────────────────────────────────
  if ((await db.block.count({ where: { page: "home" } })) === 0) {
    const coat = img("photo-1619603364904-c0498317e145");
    const coat2 = img("photo-1619603364937-8d7af41ef206");
    const shirt = img("photo-1732464517757-c47075f33821");
    const campaign = img("photo-1603189343302-e603f7add05a", 2000);
    await db.block.createMany({
      data: [
        { page: "home", type: "hero", position: 0, data: J({ eyebrow: { en: "Collection 001 / The first expression", bn: "কালেকশন ০০১ / প্রথম প্রকাশ" }, title: { en: "Quiet\nrebellion.", bn: "নিঃশব্দ\nবিদ্রোহ।" }, subtitle: { en: "Not made to fit in.\nMade to feel like you.", bn: "মানিয়ে নিতে তৈরি নয়।\nআপনার মতো অনুভব করতে তৈরি।" }, cta: { en: "Shop the collection", bn: "কালেকশন দেখুন" }, ctaLink: "/shop", secondary: { en: "Discover ORYNVE", bn: "ORYNVE আবিষ্কার করুন" }, secondaryLink: "/about", images: [coat, coat2, shirt], video: "", focal: "50% 20%", overlay: 0.25, caption: { en: "A study in form. A shift in perspective.", bn: "রূপের অধ্যয়ন। দৃষ্টিভঙ্গির পরিবর্তন।" } }) },
        { page: "home", type: "marquee", position: 1, data: J({ text: { en: "Independent in spirit · Considered by design · Not for everyone. For you.", bn: "স্বাধীন চেতনায় · ভাবনাপূর্ণ ডিজাইনে · সবার জন্য নয়। আপনার জন্য।" } }) },
        { page: "home", type: "featured", position: 2, data: J({ title: { en: "The considered edit.", bn: "ভাবনাপূর্ণ নির্বাচন।" }, subtitle: { en: "Less, but with intention. Meet your new constants.", bn: "কম, কিন্তু উদ্দেশ্য নিয়ে।" }, limit: 4 }) },
        { page: "home", type: "editorial", position: 3, data: J({ eyebrow: { en: "The philosophy", bn: "দর্শন" }, title: { en: "Presence.\nWithout the noise.", bn: "উপস্থিতি।\nকোলাহল ছাড়া।" }, text: { en: "For the ones who move differently. Who see beauty in the unassuming. Who know that less isn't a compromise — it's a point of view.", bn: "যারা অন্যভাবে চলে। যারা সাধারণের মধ্যে সৌন্দর্য দেখে। যারা জানে কম মানে আপস নয় — এটা একটা দৃষ্টিভঙ্গি।" }, image: campaign, link: "/about", button: { en: "Our philosophy", bn: "আমাদের দর্শন" } }) },
        { page: "home", type: "collections", position: 4, data: J({ title: { en: "Chapters, not seasons.", bn: "অধ্যায়, ঋতু নয়।" } }) },
        { page: "home", type: "lookbook", position: 5, data: J({ eyebrow: { en: "The campaign", bn: "ক্যাম্পেইন" }, title: { en: "Between the lines.", bn: "লাইনের মাঝে।" }, frames: [{ image: coat2, productSlug: "the-form-overcoat" }, { image: shirt, productSlug: "the-ease-shirt" }] }) },
        { page: "home", type: "arrivals", position: 6, data: J({ title: { en: "New perspective.", bn: "নতুন দৃষ্টিভঙ্গি।" }, subtitle: { en: "Fresh forms. Familiar feeling.", bn: "নতুন রূপ। পরিচিত অনুভূতি।" }, limit: 4 }) },
        { page: "home", type: "testimonials", position: 7, data: J({ items: [{ name: "Tanvir R.", city: "Dhaka", text: { en: "The overcoat fits like it was cut for me. Ordered on WhatsApp, delivered in two days.", bn: "ওভারকোটটা যেন আমার মাপেই কাটা। WhatsApp-এ অর্ডার, দুই দিনে ডেলিভারি।" } }, { name: "Sajid H.", city: "Chattogram", text: { en: "Finally a Bangladeshi brand that takes fabric seriously.", bn: "শেষ পর্যন্ত একটা বাংলাদেশি ব্র্যান্ড যারা ফেব্রিককে সিরিয়াসলি নেয়।" } }, { name: "Nafis A.", city: "Sylhet", text: { en: "Size guide was spot on. The concierge answered my delivery question at midnight.", bn: "সাইজ গাইড একদম ঠিক। মাঝরাতে কনসিয়ার্জ ডেলিভারির প্রশ্নের উত্তর দিল।" } }] }) },
        { page: "home", type: "manifesto", position: 8, data: J({ eyebrow: { en: "An independent point of view", bn: "একটি স্বাধীন দৃষ্টিভঙ্গি" }, title: { en: "Not for everyone.\nFor you.", bn: "সবার জন্য নয়।\nআপনার জন্য।" }, text: { en: "We don't dress the moment. We dress the individual. Considered menswear for a life that's entirely your own.", bn: "আমরা মুহূর্তকে সাজাই না। আমরা মানুষকে সাজাই।" }, link: "/about", button: { en: "This is ORYNVE", bn: "এটাই ORYNVE" } }) },
        { page: "home", type: "newsletter", position: 9, data: J({}) },
      ],
    });
    console.log("✔ homepage blocks");
  }

  if (process.env.SEED_DEMO_DATA !== "true" && process.env.SEED_DEMO_DATA !== undefined) {
    console.log("↷ demo data skipped (SEED_DEMO_DATA is not true)");
    return;
  }
  if ((await db.product.count()) > 0) {
    console.log("↷ demo catalogue already present");
    return;
  }

  // ── Demo catalogue ─────────────────────────────────────────────────────
  const cats = [
    ["outerwear", { en: "Outerwear", bn: "আউটারওয়্যার" }],
    ["shirts", { en: "Shirts", bn: "শার্ট" }],
    ["knitwear", { en: "Knitwear", bn: "নিটওয়্যার" }],
    ["tailoring", { en: "Tailoring", bn: "টেইলরিং" }],
    ["essentials", { en: "Essentials", bn: "এসেনশিয়ালস" }],
    ["panjabi", { en: "Panjabi", bn: "পাঞ্জাবি" }],
  ] as const;
  const catIds: Record<string, string> = {};
  for (const [i, [slug, name]] of cats.entries()) {
    const c = await db.category.create({ data: { slug, name: J(name), sortOrder: i } });
    catIds[slug] = c.id;
  }

  const collSeed: [string, Record<string, string>, Record<string, string>, string][] = [
      ["the-first-expression", { en: "The First Expression", bn: "প্রথম প্রকাশ" }, { en: "Our debut chapter. A study in form, texture, and quiet confidence.", bn: "আমাদের প্রথম অধ্যায়। রূপ, টেক্সচার ও শান্ত আত্মবিশ্বাসের অধ্যয়ন।" }, img("photo-1619603364937-8d7af41ef206")],
      ["everyday-elevated", { en: "Everyday, Elevated", bn: "প্রতিদিন, উন্নত" }, { en: "A considered edit of the pieces you reach for, again and again.", bn: "যে পিসগুলো বারবার হাতে ওঠে, তার ভাবনাপূর্ণ নির্বাচন।" }, img("photo-1732464517757-c47075f33821")],
      ["after-hours", { en: "After Hours", bn: "আফটার আওয়ার্স" }, { en: "Refined silhouettes for wherever the evening takes you.", bn: "সন্ধ্যা যেখানেই নিয়ে যাক, পরিশীলিত সিলুয়েট।" }, img("photo-1732464517792-7385024242a6")],
      ["eid-edit", { en: "The Eid Edit", bn: "ঈদ এডিট" }, { en: "Panjabi and tailoring for the season of gathering.", bn: "মিলনের মৌসুমের জন্য পাঞ্জাবি ও টেইলরিং।" }, img("photo-1603189343302-e603f7add05a")],
  ];
  const coll = await Promise.all(
    collSeed.map(([slug, name, description, image], i) => db.collection.create({ data: { slug, name: J(name), description: J(description), image, isPublished: true, sortOrder: i } })),
  );
  const collId = Object.fromEntries(coll.map((c) => [c.slug, c.id]));

  type Demo = {
    slug: string; sku: string; name: [string, string]; category: string; collections: string[]; price: number; compareAt?: number;
    colors: { value: string; hex: string }[]; sizes: [string, number][]; images: string[]; badge?: [string, string]; featured?: boolean;
    desc: [string, string]; material: [string, string]; fit: [string, string]; care: [string, string]; tags: string[];
  };
  const demo: Demo[] = [
    { slug: "the-form-overcoat", sku: "ORY-001-001", name: ["The Form Overcoat", "দ্য ফর্ম ওভারকোট"], category: "outerwear", collections: ["the-first-expression"], price: 890000, colors: [{ value: "Sand", hex: "#b09a82" }, { value: "Ink", hex: "#1c1d1a" }], sizes: [["S", 4], ["M", 8], ["L", 5], ["XL", 3]], images: [img("photo-1619603364904-c0498317e145"), img("photo-1619603364937-8d7af41ef206")], badge: ["Signature", "সিগনেচার"], featured: true, desc: ["A considered silhouette, cut to move. Our signature longline overcoat brings quiet structure to your everyday uniform.", "চলার জন্য কাটা একটি ভাবনাপূর্ণ সিলুয়েট। আমাদের সিগনেচার লংলাইন ওভারকোট আপনার দৈনন্দিন পোশাকে নিঃশব্দ গঠন আনে।"], material: ["Wool-blend outer; smooth viscose lining", "উল-ব্লেন্ড আউটার; মসৃণ ভিসকোস লাইনিং"], fit: ["Relaxed, longline fit. Designed for layering.", "রিল্যাক্সড, লংলাইন ফিট। লেয়ারিংয়ের জন্য।"], care: ["Dry clean only. Store on a wide hanger.", "শুধু ড্রাই ক্লিন। চওড়া হ্যাঙ্গারে রাখুন।"], tags: ["new", "signature", "winter"] },
    { slug: "the-ease-shirt", sku: "ORY-001-002", name: ["The Ease Shirt", "দ্য ইজ শার্ট"], category: "shirts", collections: ["the-first-expression", "everyday-elevated"], price: 320000, colors: [{ value: "Onyx", hex: "#262521" }, { value: "Chalk", hex: "#ebe8e0" }, { value: "Olive", hex: "#4a5240" }], sizes: [["S", 10], ["M", 14], ["L", 9], ["XL", 6], ["XXL", 2]], images: [img("photo-1732464517757-c47075f33821"), img("photo-1529284607059-de6f2f0e661f")], badge: ["New season", "নতুন মৌসুম"], featured: true, desc: ["An easy drape. A deliberate detail. A soft, open-collar shirt that finds its place from first light to late nights.", "সহজ ড্রেপ। সচেতন ডিটেইল। নরম ওপেন-কলার শার্ট, ভোর থেকে গভীর রাত।"], material: ["Breathable cotton blend", "শ্বাসযোগ্য কটন ব্লেন্ড"], fit: ["Relaxed fit with a dropped shoulder.", "ড্রপড শোল্ডারসহ রিল্যাক্সড ফিট।"], care: ["Machine wash cold. Line dry in shade.", "ঠান্ডা পানিতে মেশিন ওয়াশ। ছায়ায় শুকান।"], tags: ["new", "essential"] },
    { slug: "the-essential-oxford", sku: "ORY-001-003", name: ["The Essential Oxford", "দ্য এসেনশিয়াল অক্সফোর্ড"], category: "shirts", collections: ["everyday-elevated"], price: 360000, compareAt: 420000, colors: [{ value: "Chalk", hex: "#ebe8e0" }, { value: "Sky", hex: "#b8c7d6" }], sizes: [["S", 6], ["M", 12], ["L", 8], ["XL", 4]], images: [img("photo-1529284607059-de6f2f0e661f"), img("photo-1732464517757-c47075f33821")], featured: true, desc: ["The shirt you return to. Clean lines, a refined collar, and natural texture, made for a wardrobe without seasons.", "যে শার্টে ফিরে আসেন। পরিষ্কার লাইন, পরিশীলিত কলার, প্রাকৃতিক টেক্সচার।"], material: ["100% cotton Oxford weave", "১০০% কটন অক্সফোর্ড উইভ"], fit: ["Regular fit. Take your usual size.", "রেগুলার ফিট। আপনার সাধারণ সাইজ নিন।"], care: ["Wash at 30°C with similar colors. Warm iron.", "৩০°C-এ একই রঙের সাথে ধুন। গরম আয়রন।"], tags: ["essential", "sale"] },
    { slug: "the-midnight-knit", sku: "ORY-001-004", name: ["The Midnight Knit", "দ্য মিডনাইট নিট"], category: "knitwear", collections: ["after-hours"], price: 490000, colors: [{ value: "Black", hex: "#171817" }, { value: "Moss", hex: "#3e4432" }], sizes: [["S", 3], ["M", 7], ["L", 5], ["XL", 2]], images: [img("photo-1760245773960-200dbe893696")], featured: true, desc: ["A study in restraint. Fine-gauge texture and a clean crew neckline make a subtle statement in deep black.", "সংযমের অধ্যয়ন। ফাইন-গেজ টেক্সচার ও ক্লিন ক্রু নেকলাইন।"], material: ["Soft cotton-rich knit", "নরম কটন-রিচ নিট"], fit: ["Close regular fit with comfortable stretch.", "আরামদায়ক স্ট্রেচসহ ক্লোজ রেগুলার ফিট।"], care: ["Hand wash cold. Reshape and dry flat.", "ঠান্ডা পানিতে হাতে ধুন। সমতলে শুকান।"], tags: ["evening", "winter"] },
    { slug: "the-unstructured-blazer", sku: "ORY-001-005", name: ["The Unstructured Blazer", "দ্য আনস্ট্রাকচার্ড ব্লেজার"], category: "tailoring", collections: ["after-hours", "eid-edit"], price: 750000, colors: [{ value: "Graphite", hex: "#575754" }], sizes: [["S", 2], ["M", 5], ["L", 4], ["XL", 3]], images: [img("photo-1732464517792-7385024242a6")], desc: ["Tailoring, untethered. A lightly structured blazer designed to dress up without the weight of occasion.", "মুক্ত টেইলরিং। হালকা গঠনের ব্লেজার, উপলক্ষের ভার ছাড়াই সাজতে।"], material: ["Textured wool-blend suiting", "টেক্সচার্ড উল-ব্লেন্ড সুটিং"], fit: ["Relaxed through the shoulder and body.", "শোল্ডার ও বডিতে রিল্যাক্সড।"], care: ["Professional dry clean only.", "শুধু পেশাদার ড্রাই ক্লিন।"], tags: ["tailoring", "eid"] },
    { slug: "the-everyday-tee", sku: "ORY-001-006", name: ["The Everyday Tee", "দ্য এভরিডে টি"], category: "essentials", collections: ["everyday-elevated"], price: 180000, colors: [{ value: "Ecru", hex: "#ddd8ca" }, { value: "Black", hex: "#171817" }, { value: "Oxide", hex: "#c2542b" }], sizes: [["S", 15], ["M", 20], ["L", 18], ["XL", 10], ["XXL", 6]], images: [img("photo-1706905615817-75a4a27867fa")], featured: false, desc: ["Nothing extra. Everything considered. A substantial cotton tee with a softly structured silhouette.", "অতিরিক্ত কিছু নেই। সব ভাবনাপূর্ণ। নরম গঠনের ভারী কটন টি।"], material: ["100% heavyweight cotton", "১০০% হেভিওয়েট কটন"], fit: ["Boxy fit. Size down for a closer silhouette.", "বক্সি ফিট। কাছাকাছি সিলুয়েটের জন্য এক সাইজ ছোট।"], care: ["Cold machine wash. Do not tumble dry.", "ঠান্ডা মেশিন ওয়াশ। টাম্বল ড্রাই নয়।"], tags: ["essential", "basics"] },
    { slug: "the-dhaka-panjabi", sku: "ORY-001-007", name: ["The Dhaka Panjabi", "দ্য ঢাকা পাঞ্জাবি"], category: "panjabi", collections: ["eid-edit", "the-first-expression"], price: 560000, colors: [{ value: "Bone", hex: "#f3efe6" }, { value: "Ink", hex: "#1c1d1a" }, { value: "Brass", hex: "#c9a25c" }], sizes: [["S", 6], ["M", 10], ["L", 10], ["XL", 6], ["XXL", 3]], images: [img("photo-1603189343302-e603f7add05a"), img("photo-1619603364937-8d7af41ef206")], badge: ["Eid edit", "ঈদ এডিট"], featured: true, desc: ["A modern panjabi with a band collar and clean placket, cut longer with side vents. Heritage form, contemporary restraint.", "ব্যান্ড কলার ও ক্লিন প্ল্যাকেটের আধুনিক পাঞ্জাবি, সাইড ভেন্টসহ লম্বা কাট। ঐতিহ্যের রূপ, সমসাময়িক সংযম।"], material: ["Handloom cotton-silk blend", "হ্যান্ডলুম কটন-সিল্ক ব্লেন্ড"], fit: ["Straight fit, knee length.", "স্ট্রেট ফিট, হাঁটু পর্যন্ত।"], care: ["Gentle hand wash or dry clean.", "হালকা হাতে ধুন বা ড্রাই ক্লিন।"], tags: ["eid", "heritage", "new"] },
    { slug: "the-linen-trouser", sku: "ORY-001-008", name: ["The Linen Trouser", "দ্য লিনেন ট্রাউজার"], category: "tailoring", collections: ["everyday-elevated", "after-hours"], price: 420000, colors: [{ value: "Sand", hex: "#b09a82" }, { value: "Ink", hex: "#1c1d1a" }], sizes: [["30", 5], ["32", 9], ["34", 8], ["36", 4], ["38", 2]], images: [img("photo-1732464517792-7385024242a6"), img("photo-1706905615817-75a4a27867fa")], desc: ["Pleated, tapered, breathable. A linen trouser for Dhaka heat that still looks composed at eight in the evening.", "প্লিটেড, টেপারড, শ্বাসযোগ্য। ঢাকার গরমের জন্য লিনেন ট্রাউজার, সন্ধ্যা আটটাতেও পরিপাটি।"], material: ["100% European linen", "১০০% ইউরোপীয় লিনেন"], fit: ["High rise, relaxed thigh, tapered leg.", "হাই রাইজ, রিল্যাক্সড থাই, টেপারড লেগ।"], care: ["Machine wash cold, hang dry. Embrace the crease.", "ঠান্ডা মেশিন ওয়াশ, ঝুলিয়ে শুকান।"], tags: ["summer", "linen"] },
  ];

  const sizeGuide = { unit: "cm", labels: ["Size", "Chest", "Length", "Shoulder"], rows: [["S", "100", "70", "45"], ["M", "104", "72", "47"], ["L", "110", "74", "49"], ["XL", "116", "76", "51"], ["XXL", "122", "78", "53"]], notes: "Garment measurements, laid flat. Allow 1–2 cm tolerance." };

  for (const [i, d] of demo.entries()) {
    const product = await db.product.create({
      data: {
        slug: d.slug, sku: d.sku, name: J({ en: d.name[0], bn: d.name[1] }), description: J({ en: d.desc[0], bn: d.desc[1] }),
        details: J({ material: { en: d.material[0], bn: d.material[1] }, fit: { en: d.fit[0], bn: d.fit[1] }, care: { en: d.care[0], bn: d.care[1] }, shipping: { en: "Delivery within Bangladesh in 1–7 business days. Free above the thresholds shown at checkout.", bn: "বাংলাদেশে ১–৭ কর্মদিবসে ডেলিভারি।" }, returns: { en: "Exchange within 7 days of delivery. Unworn, with tags.", bn: "ডেলিভারির ৭ দিনের মধ্যে এক্সচেঞ্জ।" } }),
        status: "published", publishedAt: new Date(Date.now() - (demo.length - i) * 86400_000), categoryId: catIds[d.category], price: d.price, compareAtPrice: d.compareAt ?? null,
        featured: d.featured ?? false, badge: d.badge ? J({ en: d.badge[0], bn: d.badge[1] }) : null, tags: J(d.tags), sizeGuide: J(sizeGuide), sortOrder: i,
        seoTitle: J({ en: `${d.name[0]} | ORYNVE`, bn: `${d.name[1]} | ORYNVE` }),
        images: { create: d.images.map((url, p) => ({ url, position: p, alt: J({ en: `${d.name[0]} — view ${p + 1}`, bn: `${d.name[1]} — ভিউ ${p + 1}` }), colorName: p === 0 ? d.colors[0].value : null })) },
        options: { create: [{ name: "Size", position: 0, values: J(d.sizes.map(([s]) => ({ value: s }))) }, { name: "Color", position: 1, values: J(d.colors) }] },
        collections: { create: d.collections.map((slug, p) => ({ collectionId: collId[slug], position: p })) },
      },
    });
    let pos = 0;
    for (const [size, stock] of d.sizes) {
      for (const color of d.colors) {
        await db.productVariant.create({
          data: { productId: product.id, sku: `${d.sku}-${size}-${color.value.slice(0, 3).toUpperCase()}`, title: `${size} / ${color.value}`, options: J({ Size: size, Color: color.value }), stock: Math.max(0, Math.round(stock / d.colors.length) + (color === d.colors[0] ? stock % d.colors.length : 0)), position: pos++ },
        });
      }
    }
    await db.review.createMany({
      data: [
        { productId: product.id, customerName: "Rafi K.", rating: 5, title: "Exactly as pictured", body: "Fabric is heavier and better than expected. The fit notes were accurate.", isApproved: true },
        { productId: product.id, customerName: "Imran S.", rating: 4, title: null, body: "Great piece. Delivery to Chattogram took 4 days.", isApproved: true },
      ],
    });
  }
  console.log(`✔ ${demo.length} demo products with variants & reviews`);

  // Coupon
  await db.coupon.upsert({ where: { code: "WELCOME10" }, update: {}, create: { code: "WELCOME10", type: "percent", value: 10, minSubtotal: 200000, isActive: true } });

  // Sample orders (so the studio and concierge have something to show)
  const v = await db.productVariant.findFirst({ where: { product: { slug: "the-ease-shirt" }, options: { contains: '"M"' } }, include: { product: true } });
  if (v) {
    const mk = async (n: number, status: string, channel: string, method: string, payStatus: string, daysAgo: number) => {
      const order = await db.order.create({
        data: {
          number: `ORY-${new Date().getFullYear()}-${String(n).padStart(6, "0")}`, trackingCode: ["7KQ2MHT9", "B4NDX8PL", "Z9C3RWM6"][n - 1], status, channel, paymentMethod: method, paymentStatus: payStatus,
          subtotal: 320000, discount: 0, shipping: 8000, total: 328000, customerName: "Demo Customer", phone: "8801700000000", email: "demo@example.com",
          shippingAddress: J({ line1: "House 12, Road 5", line2: "Banani", city: "Dhaka", district: "Dhaka", postalCode: "1213", country: "BD" }), locale: "en",
          placedAt: new Date(Date.now() - daysAgo * 86400_000), courier: status === "shipped" || status === "delivered" ? "Pathao" : null, courierTracking: status === "shipped" || status === "delivered" ? "PTH123456789" : null,
          items: { create: [{ productId: v.productId, variantId: v.id, name: "The Ease Shirt", variantTitle: v.title, sku: v.sku, image: null, unitPrice: 320000, quantity: 1, total: 320000 }] },
          events: {
            create: [
              { type: "status", title: J({ en: "Order received", bn: "অর্ডার গৃহীত" }), createdAt: new Date(Date.now() - daysAgo * 86400_000) },
              ...(status !== "pending" ? [{ type: "status", title: J({ en: "Order confirmed", bn: "অর্ডার নিশ্চিত" }), message: J({ en: "Confirmed by phone.", bn: "ফোনে নিশ্চিত।" }), createdAt: new Date(Date.now() - (daysAgo - 0.5) * 86400_000) }] : []),
              ...(status === "shipped" || status === "delivered" ? [{ type: "shipping", title: J({ en: "Handed to courier", bn: "কুরিয়ারে হস্তান্তর" }), message: J({ en: "Pathao — PTH123456789", bn: "Pathao — PTH123456789" }), createdAt: new Date(Date.now() - (daysAgo - 1) * 86400_000) }] : []),
              ...(status === "delivered" ? [{ type: "status", title: J({ en: "Delivered", bn: "ডেলিভারি সম্পন্ন" }), createdAt: new Date(Date.now() - (daysAgo - 2) * 86400_000) }] : []),
            ],
          },
        },
      });
      return order;
    };
    await mk(1, "delivered", "website", "cod", "paid", 9);
    await mk(2, "shipped", "whatsapp", "bkash", "paid", 3);
    await mk(3, "pending", "website", "nagad", "pending_verification", 0.2);
    await db.customer.upsert({ where: { phone: "8801700000000" }, update: {}, create: { phone: "8801700000000", name: "Demo Customer", email: "demo@example.com" } });
    console.log("✔ 3 demo orders (track with phone 01700000000 + code 7KQ2MHT9 / B4NDX8PL / Z9C3RWM6)");
  }
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
