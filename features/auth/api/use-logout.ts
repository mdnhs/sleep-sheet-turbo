import { useMutation, useQueryClient } from "@tanstack/react-query";
import { InferResponseType } from "hono";

import { client } from "@/lib/rpc";
import { toast } from "sonner";

type ResponseType= InferResponseType<typeof client.api.auth.logout["$post"]>


export const useLogout =()=>{

    const queryclient = useQueryClient();
    const mutation= useMutation<ResponseType,Error>({
        mutationFn:async()=>{
            const response = await client.api.auth.logout["$post"]();
            if(!response.ok){
                throw new Error("Failed to log out");
            }
            return await response.json();

        },
        onSuccess:()=>{
            if (typeof window !== "undefined") {
                sessionStorage.removeItem("is_guest");
                document.cookie = "has_session=; path=/; max-age=0";
            }
            toast.success("Logged out");
            queryclient.clear();
            // Hard navigation: forces a full reload so server components
            // re-evaluate with the cleared cookie instead of a cached
            // (still-authenticated) RSC payload.
            window.location.href = "/signin";
        },
        onError:()=>{
            toast.error("Failed to log out");
        }
    })
    return mutation;
}