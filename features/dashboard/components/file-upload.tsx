/* eslint-disable @next/next/no-img-element */
"use client";
import { Upload, X, RefreshCw, Images } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  FieldValues,
  Path,
  UseFormReturn,
  FieldPathValue,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { MediaPicker } from "@/features/media/components/media-picker";

interface FileUploadProps<T extends FieldValues> {
  form?: UseFormReturn<T>;
  name?: Path<T>;
  value?: (File | string)[];
  onChange?: (files: (File | string)[]) => void;
  endpoint?: string;
  /** Also offer picking images already in the R2 media library. */
  library?: boolean;
}

export function FileUpload<T extends FieldValues>({
  form,
  name,
  value,
  onChange,
  library = false,
}: FileUploadProps<T>) {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB

  const files = (form && name ? form.watch(name) : value) as Array<File | string> || [];
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [replaceIndex, setReplaceIndex] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles = [...files, ...acceptedFiles];
      if (form && name) {
        form.setValue(name, newFiles as FieldPathValue<T, Path<T>>);
      }
      if (onChange) {
        onChange(newFiles);
      }
    },
    [form, name, files, onChange]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpeg", ".jpg"],
      "image/webp": [".webp"],
    },
    maxSize: MAX_SIZE,
    multiple: true,
    onDrop,
  });

  const addFromLibrary = (urls: string[]) => {
    const newFiles = [...files, ...urls.filter((url) => !files.includes(url))];
    if (form && name) {
      form.setValue(name, newFiles as FieldPathValue<T, Path<T>>, { shouldValidate: true });
    }
    if (onChange) onChange(newFiles);
  };

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    if (onChange) onChange(newFiles);
    if (form && name) {
      form.setValue(name, newFiles as FieldPathValue<T, Path<T>>);
    }
  };

  const handleReplaceClick = (index: number) => {
    setReplaceIndex(index);
    fileInputRef.current?.click();
  };

  const onReplaceFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && replaceIndex !== null) {
      const newFiles = [...files];
      newFiles[replaceIndex] = file;
      if (form && name) {
        form.setValue(name, newFiles as FieldPathValue<T, Path<T>>);
      }
      if (onChange) {
        onChange(newFiles);
      }
    }
    setReplaceIndex(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer 
          ${isDragActive ? "border-blue-500 bg-blue-50 dark:bg-blue-500/10" : "border-gray-300 dark:border-slate-700"}`}
      >
        <input {...getInputProps()} />
        <div className="space-y-2">
          <div className="flex items-center justify-center">
            <Upload size={32} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {isDragActive
              ? "Drop images here"
              : "Upload a file or drag and drop"}
          </p>
          <p className="text-xs text-gray-500 dark:text-slate-400">PNG, JPG, WEBP up to 5MB</p>
          <p className="text-xs text-gray-500 dark:text-slate-400">
            {files?.length > 0
              ? `${files.length} file(s) selected`
              : "No files chosen"}
          </p>
        </div>
      </div>

      {library && (
        <>
          <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setPickerOpen(true)}>
            <Images className="h-4 w-4" /> Choose from library
          </Button>
          <MediaPicker
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            kind="image"
            multiple
            exclude={files.filter((f): f is string => typeof f === "string")}
            onSelect={addFromLibrary}
          />
        </>
      )}

      {files?.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-4">
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={onReplaceFile}
            accept="image/png, image/jpeg, image/webp"
          />
          {files.map((file, index) => (
            <div key={index} className="relative overflow-hidden rounded-lg border shadow-sm">
              {index === 0 && (
                <span className="absolute top-1 left-1 z-10 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground">
                  Cover
                </span>
              )}
              {/* Always-visible controls: hover-only actions are unreachable on touch screens. */}
              <div className="absolute top-1 right-1 z-10 flex gap-1">
                <button
                  type="button"
                  title="Replace Image"
                  aria-label="Replace image"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm active:bg-black/80"
                  onClick={() => handleReplaceClick(index)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  title="Remove Image"
                  aria-label="Remove image"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-red-500/90 text-white backdrop-blur-sm active:bg-red-600"
                  onClick={() => removeFile(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <img
                src={file instanceof File ? URL.createObjectURL(file) : file}
                alt={`Preview ${index}`}
                className="h-24 sm:h-28 w-full object-cover"
                onLoad={() => {
                  if (file instanceof File) {
                    URL.revokeObjectURL(URL.createObjectURL(file));
                  }
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 text-[10px] p-1 bg-black/50 text-white truncate text-center">
                {file instanceof File ? file.name : "Saved image"}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
