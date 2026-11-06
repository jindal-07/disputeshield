import Link from "next/link";
import { Reveal, Stagger, Item } from "@/components/ui";
import { IconArrow, IconBag, IconShield, IconHandshake, IconCheck, IconDoc, IconBolt } from "@/components/icons";

const STEPS = [
  { icon: <IconBag />, title: "Agent buys", text: "A shopping agent checks out with PayPal and records exactly what its human asked for." },
  { icon: <IconBolt />, title: "Dispute lands", text: "PayPal sends the dispute by webhook. The seller agent starts investigating at once." },
  { icon: <IconDoc />, title: "Evidence weighed", text: "Orders, tracking, the listing and the intent record. Win chance and Seller Protection, scored." },
  { icon: <IconHandshake />, title: "Agents settle", text: "Seller and buyer agents negotiate a fair settlement and record how they reached it." },
  { icon: <IconCheck />, title: "You approve", text: "One click sends the offer, evidence or acceptance through the PayPal Disputes API." },
];

export default function Home() {
  return (
    <div className="stack" style={{ gap: 56 }}>
      <section className="stack" style={{ gap: 22, alignItems: "flex-start", paddingTop: 24 }}>
        <Reveal>
          <span className="eyebrow">
            <span className="pulse-dot" /> Built on the PayPal Disputes API and Claude
          </span>
        </Reveal>
        <Reveal delay={0.05}>
          <h1 className="hero-title">
            Disputes, settled by agents.<br />
            <span className="grad">Approved by you.</span>
          </h1>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="lead">
            AI shopping agents now buy on people&apos;s behalf, and disputes follow. DisputeShield investigates each
            PayPal dispute, fights the ones you can win, and settles the rest with the buyer&apos;s own agent
            before the claim escalates, and before your dispute ratio puts your account at risk.
          </p>
        </Reveal>
        <Reveal delay={0.15}>
          <div className="row" style={{ gap: 12, marginTop: 6 }}>
            <Link href="/console" className="btn btn-primary">Open seller console <IconArrow size={16} /></Link>
            <Link href="/shop" className="btn">Try the buyer agent</Link>
          </div>
        </Reveal>
      </section>

      <Stagger className="split" gap={0.1}>
        <Item>
          <Link href="/console" className="neu pad-lg lift stack" style={{ color: "inherit", gap: 16, display: "flex" }}>
            <div className="row between">
              <span className="icon-tile yellow"><IconShield size={22} /></span>
              <span className="faint"><IconArrow /></span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="tiny">For sellers</span>
              <h2 style={{ fontSize: 22 }}>Seller console</h2>
              <p className="muted">Every PayPal dispute with an AI assessment, win chance, deadline and one-click actions.</p>
            </div>
          </Link>
        </Item>
        <Item>
          <Link href="/shop" className="neu pad-lg lift stack" style={{ color: "inherit", gap: 16, display: "flex" }}>
            <div className="row between">
              <span className="icon-tile dark"><IconBag size={22} /></span>
              <span className="faint"><IconArrow /></span>
            </div>
            <div className="stack" style={{ gap: 6 }}>
              <span className="tiny">For buyers</span>
              <h2 style={{ fontSize: 22 }}>Buyer shopping agent</h2>
              <p className="muted">Ask for something in plain words. It checks out with PayPal and keeps a signed purchase-intent record.</p>
            </div>
          </Link>
        </Item>
      </Stagger>

      <section className="stack" style={{ gap: 20 }}>
        <Reveal>
          <div className="stack" style={{ gap: 6 }}>
            <span className="tiny">How it works</span>
            <h2 style={{ fontSize: 26 }}>From dispute to resolution in minutes.</h2>
          </div>
        </Reveal>
        <Stagger className="steps" gap={0.08}>
          {STEPS.map((s, i) => (
            <Item key={s.title} className="neu pad stack lift" style={{ gap: 12 }}>
              <div className="row between">
                <span className="icon-tile" style={{ width: 40, height: 40 }}>{s.icon}</span>
                <span className="step-num">{i + 1}</span>
              </div>
              <h3 style={{ fontSize: 16 }}>{s.title}</h3>
              <p className="muted small">{s.text}</p>
            </Item>
          ))}
        </Stagger>
      </section>
    </div>
  );
}
