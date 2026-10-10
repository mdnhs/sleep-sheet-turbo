"use client";

import React, { useState, useEffect, useRef } from "react";
import { useFormContext } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormLabel } from "@/components/ui/form";
import { Plus, Trash2, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

type Slide = {
  id: string;
  image: string;
  title: string;
  heading: string;
  link: string;
};

export function HeroSlidesManager() {
  const form = useFormContext();
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isUploading, setIsUploading] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadId, setActiveUploadId] = useState<string | null>(null);

  useEffect(() => {
    const heroSlidesRaw = form.getValues("hero_slides");
    if (heroSlidesRaw) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrating local slide state from the form's stored value once, on mount.
        setSlides(JSON.parse(heroSlidesRaw));
      } catch (e) {
        console.error("Failed to parse hero slides", e);
      }
    }
  }, [form, form.watch("hero_slides")]);

  const updateSlides = (newSlides: Slide[]) => {
    setSlides(newSlides);
    form.setValue("hero_slides", JSON.stringify(newSlides), { shouldDirty: true });
  };

  const addSlide = () => {
    const newSlide: Slide = {
      id: Math.random().toString(36).substring(7),
      image: "",
      title: "New Slide Title",
      heading: "New Slide Heading",
      link: "/shop",
    };
    updateSlides([...slides, newSlide]);
  };

  const removeSlide = (id: string) => {
    updateSlides(slides.filter((s) => s.id !== id));
  };

  const updateSlideField = (id: string, field: keyof Slide, value: string) => {
    updateSlides(slides.map((s) => (s.id === id ? { ...s, [field]: value } : s)));
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadId) return;

    setIsUploading((prev) => ({ ...prev, [activeUploadId]: true }));
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch("/api/testimonials/upload-image", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      
      updateSlideField(activeUploadId, "image", json.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setIsUploading((prev) => ({ ...prev, [activeUploadId]: false }));
      setActiveUploadId(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const triggerUpload = (id: string) => {
    setActiveUploadId(id);
    fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Hero Carousel Slides</CardTitle>
          <CardDescription>Manage the main banner images and text on the homepage.</CardDescription>
        </div>
        <Button type="button" onClick={addSlide} variant="outline" size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Slide
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImageSelect}
        />
        
        {slides.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            No slides configured. Using default hardcoded slides.
          </div>
        ) : (
          <div className="space-y-4">
            {slides.map((slide, index) => (
              <div key={slide.id} className="flex flex-col md:flex-row gap-4 p-4 border rounded-xl relative bg-card shadow-sm group">
                {/* Image Upload/Preview */}
                <div className="w-full md:w-48 h-32 md:h-48 shrink-0 relative bg-muted rounded-lg overflow-hidden border">
                  {slide.image ? (
                    <>
                      <Image src={slide.image} alt="Slide preview" fill className="object-cover" />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => triggerUpload(slide.id)}
                          disabled={isUploading[slide.id]}
                        >
                          {isUploading[slide.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : "Change Image"}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => triggerUpload(slide.id)}
                      disabled={isUploading[slide.id]}
                      className="w-full h-full flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      {isUploading[slide.id] ? (
                        <Loader2 className="h-6 w-6 animate-spin mb-2" />
                      ) : (
                        <ImagePlus className="h-6 w-6 mb-2" />
                      )}
                      <span className="text-xs font-medium">Upload Image</span>
                    </button>
                  )}
                </div>

                {/* Form Fields */}
                <div className="flex-1 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="font-semibold text-sm">Slide {index + 1}</h4>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeSlide(slide.id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 -mt-2 -mr-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <FormLabel>Small Title</FormLabel>
                      <Input
                        value={slide.title}
                        onChange={(e) => updateSlideField(slide.id, "title", e.target.value)}
                        placeholder="Premium Comfort"
                      />
                    </div>
                    <div className="space-y-2">
                      <FormLabel>Main Heading</FormLabel>
                      <Input
                        value={slide.heading}
                        onChange={(e) => updateSlideField(slide.id, "heading", e.target.value)}
                        placeholder="Luxury Comforters"
                      />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <FormLabel>CTA Link</FormLabel>
                      <Input
                        value={slide.link}
                        onChange={(e) => updateSlideField(slide.id, "link", e.target.value)}
                        placeholder="/shop?category=Comforters"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
