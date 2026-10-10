"use client";

import React, { useState, useEffect } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface Faq {
  question: string;
  answer: string;
}

export default function FaqAccordion({ faqs }: { faqs: Faq[] }) {
  const [value, setValue] = useState<string[]>(() =>
    faqs[0]?.question ? [faqs[0].question] : []
  );

  useEffect(() => {
    if (faqs[0]?.question && value.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- defaults the first FAQ open once `faqs` arrives async; `value` stays user-toggleable afterward.
      setValue([faqs[0].question]);
    }
  }, [faqs]);

  return (
    <Accordion
      value={value}
      onValueChange={setValue}
      className="w-full border-none space-y-4"
    >
      {faqs.map((faq) => (
        <AccordionItem
          key={faq.question}
          value={faq.question}
          className="rounded-2xl px-5 bg-white dark:bg-slate-900 data-open:bg-white dark:data-open:bg-slate-900"
        >
          <AccordionTrigger className="text-base font-medium hover:no-underline py-5">
            {faq.question}
          </AccordionTrigger>
          <AccordionContent className="pb-6 text-muted-foreground leading-relaxed">
            {faq.answer}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
