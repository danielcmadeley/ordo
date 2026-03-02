import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import { render } from "@react-email/render";
import * as React from "react";

interface WelcomeEmailProps {
  name: string;
}

const features = [
  {
    emoji: "\u{1F3AF}",
    title: "Project Manager",
    description:
      "Organise work with List, Kanban, Calendar, Gantt, and Table views. Create tasks, set milestones, and track progress across every project.",
  },
  {
    emoji: "\u{1F4D3}",
    title: "Knowledge Base",
    description:
      "Write and organise notes inside notebooks with a rich block editor. Everything auto-saves so you never lose a thought.",
  },
  {
    emoji: "\u{1F4DD}",
    title: "Daily Journal",
    description:
      "Reflect on your day with structured entries — log your focus, sleep, mood, and key takeaways in one place.",
  },
  {
    emoji: "\u{1F4AC}",
    title: "Ask Ordo (AI)",
    description:
      "Search across all your notes, tasks, and journal entries using natural language. Ordo finds the context you need instantly.",
  },
  {
    emoji: "\u{1F4B0}",
    title: "Finance",
    description:
      "Connect your bank via Open Banking to view balances and transactions alongside your work — no spreadsheets needed.",
  },
  {
    emoji: "\u{1F4E3}",
    title: "CRM",
    description:
      "Connect your X account to publish and schedule posts, browse bookmarks, and manage your social presence from Ordo.",
  },
];

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  const displayName = name || "there";

  return (
    <Html lang="en">
      <Head />
      <Preview>Welcome to Ordo — your workspace is ready</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <Text style={logoText}>ordo</Text>
          </Section>

          {/* Hero */}
          <Section style={heroSection}>
            <Heading style={heroHeading}>
              Welcome to Ordo, {displayName}
            </Heading>
            <Text style={heroSubtext}>
              Your account is set up and your workspace is ready. Ordo brings
              together everything you need to stay organised — notes, tasks,
              projects, journaling, finances, and more — all synced across your
              devices and available offline.
            </Text>
            <Section style={ctaContainer}>
              <Button style={ctaButton} href="https://app.getordo.co">
                Open your workspace
              </Button>
            </Section>
          </Section>

          <Hr style={divider} />

          {/* Features */}
          <Section style={featuresSection}>
            <Heading as="h2" style={featuresHeading}>
              What you can do with Ordo
            </Heading>
            {features.map((feature) => (
              <Section key={feature.title} style={featureRow}>
                <Row>
                  <Column style={featureEmojiCol}>
                    <Text style={featureEmoji}>{feature.emoji}</Text>
                  </Column>
                  <Column style={featureTextCol}>
                    <Text style={featureTitle}>{feature.title}</Text>
                    <Text style={featureDescription}>
                      {feature.description}
                    </Text>
                  </Column>
                </Row>
              </Section>
            ))}
          </Section>

          <Hr style={divider} />

          {/* Closing */}
          <Section style={closingSection}>
            <Text style={closingText}>
              Everything in Ordo is local-first — your data lives on your device
              and syncs in the background, so the app is always fast and works
              offline.
            </Text>
            <Text style={closingText}>
              If you have any questions or feedback, just reply to this email.
              We'd love to hear from you.
            </Text>
            <Text style={signoff}>— The Ordo Team</Text>
          </Section>

          <Hr style={divider} />

          {/* Footer */}
          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you signed up at{" "}
              <Link href="https://getordo.co" style={footerLink}>
                getordo.co
              </Link>
              . If you didn't create this account, you can safely ignore this
              email.
            </Text>
            <Text style={footerText}>
              Ordo &middot;{" "}
              <Link href="https://getordo.co" style={footerLink}>
                getordo.co
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// --- Styles ---

const main: React.CSSProperties = {
  backgroundColor: "#f4f4f5",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
};

const container: React.CSSProperties = {
  maxWidth: "520px",
  margin: "0 auto",
  padding: "32px 16px",
};

const header: React.CSSProperties = {
  padding: "0 0 24px",
  textAlign: "center" as const,
};

const logoText: React.CSSProperties = {
  fontSize: "28px",
  fontWeight: "700",
  color: "#7c3aed",
  letterSpacing: "-0.5px",
  margin: "0",
};

const heroSection: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e4e4e7",
  padding: "36px 32px 32px",
};

const heroHeading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: "600",
  color: "#18181b",
  margin: "0 0 16px",
  lineHeight: "1.3",
};

const heroSubtext: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: "1.65",
  color: "#3f3f46",
  margin: "0 0 24px",
};

const ctaContainer: React.CSSProperties = {
  textAlign: "center" as const,
};

const ctaButton: React.CSSProperties = {
  backgroundColor: "#7c3aed",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  padding: "14px 32px",
  textDecoration: "none",
  display: "inline-block",
};

const divider: React.CSSProperties = {
  borderColor: "#e4e4e7",
  borderWidth: "1px 0 0 0",
  margin: "24px 0",
};

const featuresSection: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e4e4e7",
  padding: "32px",
};

const featuresHeading: React.CSSProperties = {
  fontSize: "18px",
  fontWeight: "600",
  color: "#18181b",
  margin: "0 0 24px",
};

const featureRow: React.CSSProperties = {
  marginBottom: "20px",
};

const featureEmojiCol: React.CSSProperties = {
  width: "40px",
  verticalAlign: "top",
  paddingTop: "2px",
};

const featureEmoji: React.CSSProperties = {
  fontSize: "20px",
  margin: "0",
  lineHeight: "1",
};

const featureTextCol: React.CSSProperties = {
  verticalAlign: "top",
};

const featureTitle: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#18181b",
  margin: "0 0 4px",
  lineHeight: "1.3",
};

const featureDescription: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.55",
  color: "#52525b",
  margin: "0",
};

const closingSection: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "12px",
  border: "1px solid #e4e4e7",
  padding: "28px 32px",
};

const closingText: React.CSSProperties = {
  fontSize: "14px",
  lineHeight: "1.6",
  color: "#3f3f46",
  margin: "0 0 12px",
};

const signoff: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: "500",
  color: "#18181b",
  margin: "8px 0 0",
};

const footer: React.CSSProperties = {
  padding: "0 8px",
  textAlign: "center" as const,
};

const footerText: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: "1.5",
  color: "#a1a1aa",
  margin: "0 0 6px",
};

const footerLink: React.CSSProperties = {
  color: "#a1a1aa",
  textDecoration: "underline",
};

export async function renderWelcomeEmail(
  name: string
): Promise<{ html: string; text: string }> {
  const html = await render(WelcomeEmail({ name }));
  const text = await render(WelcomeEmail({ name }), { plainText: true });
  return { html, text };
}
