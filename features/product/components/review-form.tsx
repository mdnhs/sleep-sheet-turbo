import { useState, useEffect } from "react";
import { Star, Trash } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useAddReview } from "@/features/review/api/use-add-review";
import {
  useDeleteReview,
  useUpdateReview,
} from "@/features/review/api/use-review";
import { DeleteAlertMessage } from "@/components/DeleteAlertMessage";

const formSchema = z.object({
  comment: z.string().min(10, "Review must be at least 10 characters"),
  rating: z.number().min(1, "Please select a rating").max(5),
});

interface ReviewFormProps {
  productId: string;
  existingReview?: {
    id: string;
    rating: number;
    comment: string;
    userId: string;
  };
}

const ReviewForm = ({ productId, existingReview }: ReviewFormProps) => {
  const [hoveredRating, setHoveredRating] = useState(0);
  const { mutate: addReview, isPending: isAdding } = useAddReview(productId);
  const { mutate: updateReview, isPending: isUpdating } =
    useUpdateReview(productId);
  const { mutate: deleteReview, isPending: isDeleting } = useDeleteReview();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      comment: existingReview?.comment || "",
      rating: existingReview?.rating || 0,
    },
  });

  useEffect(() => {
    if (existingReview) {
      form.reset({
        comment: existingReview.comment,
        rating: existingReview.rating,
      });
    }
  }, [existingReview, form]);

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    if (existingReview) {
      updateReview({
        ...values,
        reviewId: existingReview.id,
      });
    } else {
      addReview({ ...values, productId });
    }
  };

  const handleDelete = () => {
    if (existingReview?.id) {
      deleteReview(existingReview.id, {
        onSuccess: () => {
          form.reset({
            rating: 0,
            comment: "",
          });
        },
      });
    }
  };

  const isProcessing = isAdding || isUpdating || isDeleting;

  return (
    <div className="bg-card rounded-md p-6 mt-6">
      <h3 className="font-semibold mb-4">
        {existingReview ? "Edit Your Review" : "Write a Review"}
      </h3>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="mb-6">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Rating</FormLabel>
                  <FormControl>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          type="button"
                          key={star}
                          onClick={() => field.onChange(star)}
                          onMouseEnter={() => setHoveredRating(star)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="text-2xl"
                          disabled={isProcessing}
                        >
                          <Star
                            className={`h-6 w-6 ${
                              star <= (hoveredRating || field.value)
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-gray-300 dark:text-slate-600"
                            } cursor-pointer`}
                          />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="comment"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Your Review</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Share your experience with this product..."
                    className="min-h-[100px]"
                    {...field}
                    disabled={isProcessing}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex gap-4">
            <Button type="submit" disabled={isProcessing}>
              {isProcessing
                ? "Processing..."
                : existingReview
                ? "Update Review"
                : "Submit Review"}
            </Button>

            {existingReview && (
              <DeleteAlertMessage onConfirm={handleDelete}>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={isProcessing}
                >
                  <Trash className="mr-2 h-4 w-4" />
                  Delete Review
                </Button>
              </DeleteAlertMessage>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ReviewForm;
