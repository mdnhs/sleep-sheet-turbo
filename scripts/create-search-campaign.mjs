import fs from "fs";

const mcpConfig = JSON.parse(fs.readFileSync("/Users/nazmulhasansourab/.gemini/config/mcp_config.json", "utf8"));
const env = mcpConfig.mcpServers["google-ads"].env;
const CUSTOMER_ID = "7930659050";

async function getAccessToken() {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GOOGLE_ADS_CLIENT_ID,
      client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error("OAuth token refresh failed: " + JSON.stringify(data));
  return data.access_token;
}

export async function createSearchCampaign({ validateOnly = true, dailyBudgetUsd = 5.0 } = {}) {
  const token = await getAccessToken();
  const url = `https://googleads.googleapis.com/v22/customers/${CUSTOMER_ID}/googleAds:mutate?validateOnly=${validateOnly}`;

  const budgetMicros = Math.round(dailyBudgetUsd * 1000000).toString();
  const timestamp = new Date().toISOString().split("T")[0];

  const keywords = [
    { text: "কমফোর্টার সেট", matchType: "PHRASE" },
    { text: "৫ পিস কমফোর্টার সেট", matchType: "PHRASE" },
    { text: "comforter set price in bd", matchType: "PHRASE" },
    { text: "luxury comforter set bd", matchType: "PHRASE" },
    { text: "bed sheet bd", matchType: "PHRASE" },
    { text: "sleep sheet bd", matchType: "PHRASE" },
    { text: "king size bed sheet bd", matchType: "PHRASE" },
    { text: "cotton comforter bd", matchType: "PHRASE" },
    { text: "চাদর ও কমফোর্টার সেট", matchType: "PHRASE" },
    { text: "comforter set", matchType: "EXACT" },
    { text: "কমফোর্টার সেট", matchType: "EXACT" },
    { text: "sleep sheet", matchType: "EXACT" },
  ];

  const headlines = [
    { text: "৫ পিস কমপ্লিট সেট ৩,১৯০৳" },
    { text: "Sleep Sheet™ অফিসিয়াল স্টোর" },
    { text: "লাক্সারি কমফোর্টার সেট" },
    { text: "১০০% প্রিমিয়াম কটন ফ্যাব্রিক" },
    { text: "সারা দেশে ক্যাশ অন ডেলিভারি" },
    { text: "পণ্য দেখে নেওয়ার সুযোগ" },
    { text: "৭ দিনের সহজ রিপ্লেসমেন্ট" },
    { text: "বেডশিট ও কমফোর্টার কম্বো" },
    { text: "King Size Comforter Set" },
    { text: "Winter Luxury Bedding BD" },
    { text: "অরিজিনাল স্লিপ শিট সেট" },
    { text: "অর্ডার করুন অনলাইনে" },
  ];

  const descriptions = [
    { text: "১টি কমফোর্টার, ১টি চাদর, ২টি বালিশের কভার ও ১টি কোলবালিশের কভার মাত্র ৩,১৯০ টাকায়।" },
    { text: "সারা বাংলাদেশে ক্যাশ অন ডেলিভারি। ডেলিভারির সময় পার্সেল খুলে চেক করে নেওয়ার সুবিধা।" },
    { text: "রপ্তানি মানের প্রিমিয়াম কটন ফেব্রিকে তৈরি লাক্সারি স্লিপ শিট কমফোর্টার সেট।" },
    { text: "কোনো অগ্রিম পেমেন্ট নেই। ১০০% সন্তুষ্টি অথবা ৭ দিনের সহজ রিপ্লেসমেন্ট গ্যারান্টি।" },
  ];

  const mutateOperations = [
    // 1. Budget Operation
    {
      campaignBudgetOperation: {
        create: {
          resourceName: `customers/${CUSTOMER_ID}/campaignBudgets/-1`,
          name: `Search Budget - $${dailyBudgetUsd}/day (${timestamp})`,
          amountMicros: budgetMicros,
          explicitlyShared: false,
          deliveryMethod: "STANDARD",
        },
      },
    },
    // 2. Campaign Operation
    {
      campaignOperation: {
        create: {
          resourceName: `customers/${CUSTOMER_ID}/campaigns/-2`,
          name: `Search - Luxury Comforter & Bedding BD (${timestamp})`,
          advertisingChannelType: "SEARCH",
          status: "ENABLED",
          campaignBudget: `customers/${CUSTOMER_ID}/campaignBudgets/-1`,
          maximizeConversions: {},
          containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
          networkSettings: {
            targetGoogleSearch: true,
            targetSearchNetwork: false,
            targetContentNetwork: false,
            targetPartnerSearchNetwork: false,
          },
          geoTargetTypeSetting: {
            positiveGeoTargetType: "PRESENCE",
          },
        },
      },
    },
    // 3. Campaign Criteria - Location (Bangladesh = 2050)
    {
      campaignCriterionOperation: {
        create: {
          campaign: `customers/${CUSTOMER_ID}/campaigns/-2`,
          location: {
            geoTargetConstant: "geoTargetConstants/2050",
          },
        },
      },
    },
    // 4. Campaign Criteria - Language (Bengali = 1056)
    {
      campaignCriterionOperation: {
        create: {
          campaign: `customers/${CUSTOMER_ID}/campaigns/-2`,
          language: {
            languageConstant: "languageConstants/1056",
          },
        },
      },
    },
    // 5. Campaign Criteria - Language (English = 1000)
    {
      campaignCriterionOperation: {
        create: {
          campaign: `customers/${CUSTOMER_ID}/campaigns/-2`,
          language: {
            languageConstant: "languageConstants/1000",
          },
        },
      },
    },
    // 6. Ad Group
    {
      adGroupOperation: {
        create: {
          resourceName: `customers/${CUSTOMER_ID}/adGroups/-3`,
          name: "High Intent - Comforter & Bedding",
          campaign: `customers/${CUSTOMER_ID}/campaigns/-2`,
          status: "ENABLED",
          type: "SEARCH_STANDARD",
        },
      },
    },
    // 7. Responsive Search Ad
    {
      adGroupAdOperation: {
        create: {
          adGroup: `customers/${CUSTOMER_ID}/adGroups/-3`,
          status: "ENABLED",
          ad: {
            responsiveSearchAd: {
              headlines: headlines.map((h) => ({ text: h.text })),
              descriptions: descriptions.map((d) => ({ text: d.text })),
              path1: "কমফোর্টার",
              path2: "সেট",
            },
            finalUrls: ["https://sleepsheetbd.com/categories/comforter-set"],
          },
        },
      },
    },
  ];

  // 8. Add Keywords
  keywords.forEach((kw) => {
    mutateOperations.push({
      adGroupCriterionOperation: {
        create: {
          adGroup: `customers/${CUSTOMER_ID}/adGroups/-3`,
          status: "ENABLED",
          keyword: {
            text: kw.text,
            matchType: kw.matchType,
          },
        },
      },
    });
  });

  // 9. Attach Top 6 Sitelink Assets
  const sitelinkAssetIds = [
    "428879928507", // বেস্টসেলার কমফোর্টার
    "428879971473", // প্রিমিয়াম ৫ পিস সেট
    "428692099850", // হোয়াইট পিঙ্ক কমফোর্টার
    "428794409557", // রয়্যাল ব্লু কমফোর্টার
    "428692099853", // কিং সাইজ বেডশিট
    "428794457485", // নতুন কালেকশন ২০২৬
  ];

  sitelinkAssetIds.forEach((assetId) => {
    mutateOperations.push({
      campaignAssetOperation: {
        create: {
          campaign: `customers/${CUSTOMER_ID}/campaigns/-2`,
          asset: `customers/${CUSTOMER_ID}/assets/${assetId}`,
          fieldType: "SITELINK",
        },
      },
    });
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mutateOperations }),
  });

  const data = await res.json();
  return data;
}

if (process.argv[1] && process.argv[1].endsWith("create-search-campaign.mjs")) {
  const isLive = process.argv.includes("--live");
  console.log(`Running Search Campaign creation (mode: ${isLive ? "LIVE" : "VALIDATION ONLY"})...`);
  createSearchCampaign({ validateOnly: !isLive, dailyBudgetUsd: 5.0 })
    .then((res) => {
      console.log("Response:", JSON.stringify(res, null, 2));
    })
    .catch((err) => {
      console.error("Error:", err);
    });
}
