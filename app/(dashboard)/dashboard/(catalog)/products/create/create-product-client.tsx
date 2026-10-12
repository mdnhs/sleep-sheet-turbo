"use client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectTrigger,
  SelectValue,
  SelectItem,
} from "@/components/ui/select";
import { TiptapEditor } from "@/components/tiptap-editor";
import { Package, Save, Settings, Loader2, ImagePlus, Film } from "lucide-react";
import React, { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useGetProduct } from "@/features/product/api/use-get-product";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ProductSchema } from "@/features/dashboard/schema";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { ChipsInput } from "@/components/chip-input";
import { FileUpload } from "@/features/dashboard/components/file-upload";
import { ProductVideoUpload } from "@/features/dashboard/components/product-video-upload";
import { useCreateProduct } from "@/features/dashboard/api/use-create-product";
import { SpecificationFields } from "@/features/dashboard/components/specifications-fields";
import { VariantFields } from "@/features/dashboard/components/variant-fields";
import { AddOnFields } from "@/features/dashboard/components/add-on-fields";
import { useGetCategories } from "@/features/categories/api/use-get-categories";

function AddProductClient() {
  const router = useRouter();
  const { mutate, isPending } = useCreateProduct();
  const { data: categories } = useGetCategories();
  const searchParams = useSearchParams()
  const duplicateId = searchParams.get("duplicate")
  const { data: duplicateProduct } = useGetProduct({ id: duplicateId ?? "" })

  const form = useForm<z.infer<typeof ProductSchema>>({
    // zodResolver's inferred input type (pre z.coerce) vs react-hook-form's
    // output type (post z.coerce) don't line up here — a known friction point
    // between @hookform/resolvers and zod v4's coerce schemas, not a careless any.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(ProductSchema) as any,
    defaultValues: {
      productName: "",
      productDescription: "",
      productPrice: 0,
      productStock: 0,
      productCategory: "",
      productSKU: "",
      productVariants: [],
      productAddOns: [],
      productImages: [],
      productVideo: "",
      productTags: [],
      productSize: [],
      specifications: [
        { key: "Material", value: "" },
        {
          key: "Weight",
          value: "",
        },
        {
          key: "Origin",
          value: "",
        },
      ],
      productFeatures: [],
      careInstructions: "",
      isFeatured: false,
      discount: 0,
      defaultVariantName: "",
    },
  });

  useEffect(() => {
    if (duplicateProduct) {
      form.reset({
        productName: duplicateProduct.name,
        productDescription: duplicateProduct.description,
        productPrice: duplicateProduct.price,
        productStock: duplicateProduct.stock,
        productCategory: duplicateProduct.category,
        productSKU: duplicateProduct.sku ? Math.random().toString(36).substring(2, 8).toUpperCase() : "",
        productImages: duplicateProduct.images,
        productTags: duplicateProduct.tags,
        productSize: duplicateProduct.sizes,
        specifications: duplicateProduct.specifications,
        productFeatures: duplicateProduct.features,
        careInstructions: duplicateProduct.care,
        isFeatured: duplicateProduct.isFeatured,
        discount: duplicateProduct.discount,
        productVariants: duplicateProduct.colors,
        productAddOns: duplicateProduct.addOns || [],
        defaultVariantName: duplicateProduct.defaultVariantName ?? "",
      })
    }
  }, [duplicateProduct])
  type ProductFormValues = z.infer<typeof ProductSchema>;

  const onSubmit = async (values: ProductFormValues) => {
    const formData = new FormData();

    formData.append("productName", values.productName);
    formData.append("productDescription", values.productDescription);
    formData.append("productPrice", values.productPrice.toString());
    formData.append("productStock", values.productStock.toString());
    formData.append("productCategory", values.productCategory);
    formData.append("productSKU", values.productSKU);
    formData.append("productVariants", JSON.stringify(values.productVariants || []));
    formData.append("productAddOns", JSON.stringify(values.productAddOns || []));
    formData.append("productTags", JSON.stringify(values.productTags || []));
    formData.append("specifications", JSON.stringify(values.specifications || []));
    formData.append("productSize", JSON.stringify(values.productSize || []));
    formData.append("productFeature", JSON.stringify(values.productFeatures || []));
    formData.append("careInstruction", values.careInstructions || "");
    formData.append("isFeatured", values.isFeatured ? "true" : "false");
    formData.append("discount", (values.discount || 0).toString());
    formData.append("defaultVariantName", values.defaultVariantName || "");
    formData.append("productVideo", values.productVideo || "");

    values.productImages.forEach((file) => {
      if (file instanceof File) {
        formData.append("productImages", file);
      } else {
        formData.append("productImages", file);
      }
    });
    mutate(formData, {
      onSuccess: () => {
        form.reset();
        router.push("/dashboard/products");
      },
    });
  };

  return (
    <div className="container mx-auto p-3 sm:p-4 animate-in fade-in duration-300">
      <h1 className="text-3xl font-bold mb-4 sm:mb-6">Add New Product</h1>

      <Form {...form}>
        <form className="space-y-3 sm:space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {/* Photos first: on mobile this used to sit at the bottom of the Settings
              card, well past a long scroll of fields — moved up so it's the first
              thing reachable on any screen size. */}
          <Card className="w-full py-4 sm:py-6">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <ImagePlus size={24} />
                Product Photos
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <FormField
                name="productImages"
                control={form.control}
                render={() => (
                  <FormItem>
                    <FormControl>
                      <FileUpload form={form} name="productImages" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card className="w-full py-4 sm:py-6">
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Film size={24} />
                Product Video <span className="text-sm font-normal text-muted-foreground">(optional)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <FormField
                name="productVideo"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ProductVideoUpload value={field.value ?? ""} onChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row">
            <Card className="w-full lg:w-2/3 py-4 sm:py-6">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Package size={24} />
                  Product Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <FormField
                  name="productName"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">
                        Product Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Product Name"
                          required
                          {...field}
                          className="w-full mb-3 sm:mb-4"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="productDescription"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold">
                        Product Description
                      </FormLabel>
                      <FormControl>
                        <TiptapEditor
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                 <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <FormField
                    name="productPrice"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className=" w-full">
                        <FormLabel className="text-sm font-semibold">
                          Product Price
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0.00"
                            required
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="discount"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className=" w-full">
                        <FormLabel className="text-sm font-semibold">
                          Discount Percentage (%)
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    name="productStock"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className=" w-full">
                        <FormLabel className="text-sm font-semibold">
                          Product Stock
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            required
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value === "" ? "" : Number(e.target.value))
                            }
                            className="w-full"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  name="productSKU"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-semibold">
                        SKU (Stock Keeping Unit)
                      </FormLabel>
                      <FormControl>
                        <div className="flex gap-2 mb-2">
                          <Input
                            type="text"
                            placeholder="Enter product SKU"
                            required
                            {...field}
                            className="w-full"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              const sku = Math.random().toString(36).substring(2, 8).toUpperCase();
                              form.setValue("productSKU", sku, { shouldValidate: true });
                            }}
                          >
                            Auto Generate
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
                  <div className="w-full">
                    <VariantFields control={form.control} setValue={form.setValue} />
                    <AddOnFields control={form.control} setValue={form.setValue} />
                  </div>

                  <FormField
                    name="productTags"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className=" w-full">
                        <FormLabel className="block text-sm font-semibold ">
                          Tags
                        </FormLabel>
                        <FormControl>
                          <ChipsInput
                            value={field.value || []}
                            onChange={field.onChange}
                            placeholder="Add tags (press Enter or comma)"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  name="productFeatures"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className=" w-full">
                      <FormLabel className="block text-sm font-semibold ">
                        Product Features
                      </FormLabel>
                      <FormControl>
                        <ChipsInput
                          value={field.value || []}
                          onChange={field.onChange}
                          placeholder="Add Features (press Enter or comma)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name="careInstructions"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-semibold mt-3 sm:mt-4">
                        Care Instruction (optional)
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder=" Care Instruction"
                          required
                          {...field}
                          className="w-full mb-3 sm:mb-4"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="isFeatured"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2 mt-3 sm:mt-4">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-semibold inline-block">
                        Mark as Featured Product (optional)
                      </FormLabel>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("productVariants") && form.watch("productVariants")!.length > 0 && (
                  <FormField
                    name="defaultVariantName"
                    control={form.control}
                    render={({ field }) => (
                      <FormItem className="mt-3 sm:mt-4">
                        <FormLabel className="block text-sm font-semibold mb-1">
                          Default Variant Price to Display
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full h-10 border border-input rounded-xl px-3 bg-white dark:bg-slate-900">
                              <SelectValue placeholder="Select default variant" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">None (Use base product price)</SelectItem>
                            {/* eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form's watch() called during render is its documented usage; not compiler-optimizable, but correct. */}
                            {form.watch("productVariants")?.map((variant) => (
                              <SelectItem key={variant.name} value={variant.name}>
                                {variant.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Product Settings Card */}
            <Card className="w-full lg:w-1/3 py-4 sm:py-6">
              <CardHeader className="px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-2xl">
                  <Settings size={24} />
                  Product Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 sm:px-6">
                <FormField
                  name="productCategory"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="block text-sm font-semibold mb-2">
                        Category
                      </FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(value) => field.onChange(value)}
                          value={field.value}
                          defaultValue={field.value}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select categories" />
                          </SelectTrigger>
                          <SelectContent>
                            {categories?.map((category) => (
                              <SelectItem
                                key={category.label}
                                value={category.value}
                              >
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name="productSize"
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className=" w-full">
                      <FormLabel className="block text-sm font-semibold mt-3 sm:mt-4">
                        Product size (optional)
                      </FormLabel>
                      <FormControl>
                        <ChipsInput
                          value={field.value || []}
                          onChange={field.onChange}
                          placeholder="Add Product Size (press Enter or comma)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <SpecificationFields
                  control={form.control}
                  setValue={form.setValue}
                />
              </CardContent>
            </Card>
          </div>

          <div className="sticky bottom-16 sm:bottom-0 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-end mt-6 sm:mt-8 p-3 sm:p-4 -mx-3 sm:-mx-4 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Button
              type="button"
              size="lg"
              variant="outline"
              className="w-full sm:w-[120px]"
              onClick={() => form.reset()}
            >
              Clear
            </Button>

            <Button type="submit" size="lg" className="w-full sm:w-[120px]" disabled={isPending}>
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Publish
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default AddProductClient;
