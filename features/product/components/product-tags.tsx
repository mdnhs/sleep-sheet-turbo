import { Badge } from "@/components/ui/badge";
import { toTitleCase } from "@/lib/utils";
import React from "react";

interface ProductTagsProps {
  tags: string[];
}

function ProductTag({ tags }: ProductTagsProps) {
  return (
    <div className=" mb-4 flex flex-wrap gap-2">
      {tags.map((tag, index) => (
        <Badge key={index} className=" p-1 px-2 text-xs cursor-pointer">
          {toTitleCase(tag)}
        </Badge>
      ))}
    </div>
  );
}

export default ProductTag;
