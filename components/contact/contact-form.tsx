"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/hooks/use-language";

export function ContactForm() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormData({ name: "", email: "", subject: "", message: "" });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          {t("contactFormName")}
        </label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder={t("contactFormNamePlaceholder")}
          required
        />
      </div>
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          {t("contactFormEmail")}
        </label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          placeholder={t("contactFormEmailPlaceholder")}
          required
        />
      </div>
      <div>
        <label htmlFor="subject" className="block text-sm font-medium mb-1">
          {t("contactFormSubject")}
        </label>
        <Input
          id="subject"
          name="subject"
          value={formData.subject}
          onChange={handleChange}
          placeholder={t("contactFormSubjectPlaceholder")}
          required
        />
      </div>
      <div>
        <label htmlFor="message" className="block text-sm font-medium mb-1">
          {t("contactFormMessage")}
        </label>
        <Textarea
          id="message"
          name="message"
          value={formData.message}
          onChange={handleChange}
          placeholder={t("contactFormMessagePlaceholder")}
          rows={5}
          required
          className="min-h-[120px]"
        />
      </div>
      <Button type="submit" className="w-full">
        {t("contactFormSubmit")}
      </Button>
    </form>
  );
}
