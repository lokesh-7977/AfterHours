import type { ReactNode } from "react";
import { getContactEmail } from "@/lib/contact";
import { FaqAccordion } from "./faq-accordion";
import { HandNote, Marker } from "./section-header";

/** Answers render on the server; the accordion behaviour lives in FaqAccordion. */
export function FaqSection() {
  const contact = getContactEmail();
  const faqs: [string, ReactNode][] = [
    ["What is AfterHours?", "AfterHours is a platform for discovering events created and managed by AfterHours."],
    ["Who can publish events?", "Only authorized AfterHours administrators can create and publish events."],
    ["How do I express interest in an event?", <>Open an event and select &ldquo;Express Interest.&rdquo; You&apos;ll be asked to sign in first if you aren&apos;t already.</>],
    [
      "Does expressing interest confirm my ticket?",
      "No. Expressing interest does not guarantee a ticket or confirm registration. Follow the instructions provided for each event.",
    ],
    ["Are all events free?", "Not necessarily. Each event displays its applicable entry fee or registration information."],
    ["How can I find event details?", "Open an event card to view its description, schedule, location, and participation instructions."],
    [
      "Can I change my interest in an event?",
      <>
        Yes. Select &ldquo;Interested&rdquo; again to remove it. Signed-in members can see every event they&apos;re interested in under My events in their
        account.
      </>,
    ],
    ...(contact
      ? ([
          [
            "How can I contact AfterHours?",
            <>
              Email us at <a href={`mailto:${contact}`} className="link">{contact}</a>.
            </>,
          ],
        ] as [string, ReactNode][])
      : []),
  ];
  return (
    <section id="faq" aria-labelledby="faq-title" className="section bg-[var(--color-card)]">
      <div className="container-page grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.4fr)] lg:gap-16">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <HandNote tone="saffron" className="mb-2 -rotate-2">
            asked often
          </HandNote>
          <h2 id="faq-title" data-split className="heading">
            Good questions. <Marker tone="peacock">Clear answers.</Marker>
          </h2>
        </div>
        <div data-reveal>
          <FaqAccordion items={faqs.map(([q, a]) => ({ q, a }))} />
        </div>
      </div>
    </section>
  );
}
