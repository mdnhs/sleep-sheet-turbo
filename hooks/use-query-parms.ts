"use client";

import { useSearchParams } from "next/navigation";

export const useQueryParams = () => {
    const searchParams = useSearchParams();

    const getParam =(key:string):string| null =>{
        return searchParams.get(key);
    }
    const getAllParams = (): Record<string, string> => {
        const params: Record<string, string> = {};
        searchParams.forEach((value, key) => {
          params[key] = value;
        });
        return params;
      };

      return {
        getParam,
        getAllParams,
      };

}