import os
import json
import logging
from langchain_openai import ChatOpenAI

# Suppress verbose debug logging from third-party HTTP clients
logging.getLogger("openai").setLevel(logging.WARNING)
logging.getLogger("httpx").setLevel(logging.WARNING)


# Hệ thống nạp file .env linh hoạt
def load_env_file():
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass
    
    # Đọc thủ công nếu thư viện dotenv không hoạt động
    env_path = os.path.join(os.getcwd(), ".env")
    if not os.getenv("MINIMAX_API_KEY") and os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

# Nạp cấu hình
load_env_file()

SYSTEM_PROMPT = """
You are a Google Ads Copywriting expert specializing in creating high-quality Google Search Ads for a wide variety of industries.

IMPORTANT:
- STRICT CHARACTER LIMITS (SPACES ARE COUNTED AS CHARACTERS):
  * Every headline MUST be strictly 30 characters or less (including spaces). Do not generate any headline with 31 or more characters!
  * Every description MUST be strictly 90 characters or less (including spaces).
  * Every sitelink title/title MUST be strictly 25 characters or less (including spaces).
  * Every sitelink description (description1 and description2) MUST be strictly 35 characters or less (including spaces).
- Keep your internal reasoning extremely brief.
- Never explain your reasoning.
- Always follow every instruction provided by the user.
- Return ONLY the requested JSON output.

Your task is to read the project information provided by the user, including (when available):
- Website URL
- Brand name
- Project name
- Product or service description
- Target audience
- Target market
- Language
- Additional requirements
- Forbidden words
- Character limits

Then generate Google Ads Search Ads copy.

The JSON output MUST follow this exact schema structure:

{
  "brand_keywords": [
    "keyword 1",
    "keyword 2",
    ...
    "keyword 20"
  ],
  "headlines": [
    "headline 1",
    "headline 2",
    ...
    "headline 30"
  ],
  "descriptions": [
    "description 1",
    "description 2",
    ...
    "description 8"
  ],
  "sitelinks": [
    {
      "title": "sitelink title (max 25 chars)",
      "description1": "sitelink line 1 desc (max 35 chars)",
      "description2": "sitelink line 2 desc (max 35 chars)"
    },
    ...
    10 sitelinks in total
  ]
}

Generate the output using the following rules.

Brand Keywords

- Generate EXACTLY 20 brand keywords.
- Include branded search keywords based on the provided brand name.
- Include common brand variations, navigational keywords, and commercial-intent keywords whenever appropriate.
- If no brand name is provided, generate relevant branded-style search keywords based on the project name.
- Avoid duplicate keywords.

Headlines

- Generate EXACTLY 30 headlines.
- Maximum 30 characters each unless the user specifies another limit.
- The first 10 headlines MUST be high-converting CTA headlines and naturally include the brand name whenever available.
- Suitable CTA styles include:
  - Official Website
  - Sign Up Now
  - Create Account
  - Get Started
  - Try Demo
  - View Pricing
  - Learn More
  - Explore Features
  - Book a Demo
  - Contact Sales
- The remaining headlines should emphasize features, value propositions, user intent, or product benefits.
- Avoid duplicate headlines.

Descriptions

- Generate EXACTLY 8 descriptions.
- Maximum 90 characters each unless the user specifies another limit.
- Support the headlines with persuasive, informative, and policy-compliant messaging.
- Highlight relevant features or benefits without exaggeration.
- Avoid duplicate descriptions.

Sitelinks

- Generate EXACTLY 10 sitelinks.
- Each sitelink must contain:
  - title
  - description1
  - description2
- Default limits:
  - title: maximum 25 characters
  - description1: maximum 35 characters
  - description2: maximum 35 characters
- Include several core sitelinks whenever appropriate, including:
  - Sign Up
  - Pricing
  - Demo
  - Features
  - Contact
  - About
  - Support
  - Documentation
  - FAQ
  - Resources

General Guidelines

- Write natural, concise, and persuasive Google Search Ads copy.
- Match the requested language exactly.
- Use the brand name naturally across headlines and descriptions whenever available.
- Optimize for click-through rate while remaining compliant with Google Ads policies.
- Keep every generated asset unique.

Compliance Rules

- Never fabricate information.
- Do NOT claim:
  - Free
  - Bonus
  - Guaranteed profit
  - Guaranteed results
  - No risk
  - No.1
  - Market leader
  - Licensed
  - Certified
  - Official partner
  - Discount
  - Promotion
unless the user explicitly provides those facts.

Sensitive Industries

For industries including but not limited to:
- Crypto
- Forex
- Gambling
- Prediction Markets
- Finance
- Healthcare
- Medical
- Legal
- Insurance

Use neutral, policy-compliant language.

Avoid:
- Unrealistic promises
- Guaranteed outcomes
- Misleading financial claims
- Misleading medical claims
- Aggressive marketing language

Forbidden Words

- If the user provides forbidden words, never use them anywhere in the output.

Writing Style

- Do not write entire sentences in ALL CAPS.
- Avoid excessive exclamation marks.
- Avoid repetitive wording.
- Avoid duplicate headlines, descriptions, keywords, and sitelinks.

Character Limits

Unless the user specifies otherwise:
- Headline: maximum 30 characters
- Description: maximum 90 characters
- Sitelink title: maximum 25 characters
- Sitelink description: maximum 35 characters

Before returning the response, verify:
- The output is valid JSON.
- The JSON matches the required schema exactly.
- There are exactly:
  - 20 brand keywords
  - 30 headlines
  - 8 descriptions
  - 10 sitelinks
- Character limits are respected.
- No duplicated content exists.
- No forbidden words are present.
- No fabricated claims are included.
- The output language matches the user's requested language.
- Do not include markdown, explanations, comments, or any text outside the JSON object.
"""

def format_user_prompt(project_data: dict, language: str = "English", custom_requirements: str = "") -> str:
    website = project_data.get("website") or project_data.get("domain") or ""
    project_name = project_data.get("project_name") or ""
    
    # Collect short description & website insights
    description_parts = []
    if project_data.get("answer"):
        description_parts.append(f"Tavily Summary Answer: {project_data['answer']}")
    if project_data.get("event_content"):
        description_parts.append(f"Events/Campaigns: {project_data['event_content']}")
    if project_data.get("sale_content"):
        description_parts.append(f"Sales/Offers: {project_data['sale_content']}")
    
    results = project_data.get("results") or []
    snippets = []
    for r in results[:5]:
        title = r.get("title") or ""
        content = r.get("content") or ""
        snippets.append(f"- {title}: {content}")
    if snippets:
        description_parts.append("Web Search Insights:\n" + "\n".join(snippets))
        
    description = "\n\n".join(description_parts)
    
    top_countries = project_data.get("top_countries") or []
    market = ", ".join([c.get("country") for c in top_countries if c.get("country")]) if isinstance(top_countries, list) else ""
    
    user_msg = f"""PROJECT INFORMATION:
- Website: {website}
- Project Name: {project_name}
- Target Market: {market}
- Project Insights/Description:
{description}

ADDITIONAL REQUIREMENTS:
- Output Language: {language}
- Custom Requirements: {custom_requirements}
"""
    return user_msg

def sanitize_ads_copy(ads: dict) -> dict:
    """
    Sanitize and enforce strict character limits on generated Google Ads assets
    by truncating gracefully at word boundaries whenever possible.
    """
    brand_keywords = ads.get("brand_keywords") or []
    headlines = ads.get("headlines") or []
    descriptions = ads.get("descriptions") or []
    sitelinks = ads.get("sitelinks") or []

    # Clean and limit headlines to max 30 characters
    clean_headlines = []
    for h in headlines:
        h = str(h).strip()
        if len(h) > 30:
            truncated = h[:30]
            if " " in h[:30]:
                last_space = h[:30].rfind(" ")
                if last_space > 15:
                    truncated = h[:last_space]
            h = truncated.strip()
        clean_headlines.append(h)

    # Clean and limit descriptions to max 90 characters
    clean_descriptions = []
    for d in descriptions:
        d = str(d).strip()
        if len(d) > 90:
            truncated = d[:90]
            if " " in d[:90]:
                last_space = d[:90].rfind(" ")
                if last_space > 50:
                    truncated = d[:last_space]
            d = truncated.strip()
        clean_descriptions.append(d)

    # Clean and limit sitelinks
    clean_sitelinks = []
    for s in sitelinks:
        if not isinstance(s, dict):
            continue
        
        # Sitelink title: max 25 characters
        title = str(s.get("title") or s.get("text") or "").strip()
        if len(title) > 25:
            truncated = title[:25]
            if " " in title[:25]:
                last_space = title[:25].rfind(" ")
                if last_space > 10:
                    truncated = title[:last_space]
            title = truncated.strip()
            
        # description1: max 35 characters
        d1 = str(s.get("description1") or "").strip()
        if len(d1) > 35:
            truncated = d1[:35]
            if " " in d1[:35]:
                last_space = d1[:35].rfind(" ")
                if last_space > 15:
                    truncated = d1[:last_space]
            d1 = truncated.strip()

        # description2: max 35 characters
        d2 = str(s.get("description2") or "").strip()
        if len(d2) > 35:
            truncated = d2[:35]
            if " " in d2[:35]:
                last_space = d2[:35].rfind(" ")
                if last_space > 15:
                    truncated = d2[:last_space]
            d2 = truncated.strip()

        clean_sitelinks.append({
            "title": title,
            "description1": d1,
            "description2": d2
        })

    return {
        "brand_keywords": [str(k).strip() for k in brand_keywords],
        "headlines": clean_headlines,
        "descriptions": clean_descriptions,
        "sitelinks": clean_sitelinks
    }

def generate_ads_from_insights(
    project_data: dict, 
    language: str = "English", 
    custom_requirements: str = "",
    api_key: str = None
) -> dict:
    """
    Generate Google Ads Search Ads copy from Tavily search results using MiniMax-M3 LLM.
    """
    api_key = api_key or os.getenv("MINIMAX_API_KEY")
    if not api_key:
        raise ValueError("MINIMAX_API_KEY environment variable is not configured")

    llm = ChatOpenAI(
        model="MiniMax-M3",
        api_key=api_key,
        base_url="https://api.minimax.io/v1",
        temperature=0.7,
        model_kwargs={
            "response_format": {"type": "json_object"},  # Enforce JSON output format
            "extra_body": {"thinking": {"type": "disabled"}},  # Disable thinking (reasoning) to save time and resources
        },
    )

    user_prompt = format_user_prompt(
        project_data=project_data, 
        language=language, 
        custom_requirements=custom_requirements
    )

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": user_prompt}
    ]

    try:
        response = llm.invoke(messages)
        full_content = response.content
    except Exception as exc:
        raise exc

    try:
        import re
        # 1. Remove thinking block <think>...</think> if present
        clean_json = re.sub(r"<think>.*?</think>", "", full_content, flags=re.DOTALL).strip()
        # 2. Remove markdown code blocks ```json ... ``` if present
        code_block_match = re.search(r"```(?:json)?\s*(.*?)\s*```", clean_json, flags=re.DOTALL)
        if code_block_match:
            clean_json = code_block_match.group(1).strip()
        # 3. Extract JSON substring from first '{' to last '}'
        first_brace = clean_json.find("{")
        last_brace = clean_json.rfind("}")
        if first_brace != -1 and last_brace != -1:
            clean_json = clean_json[first_brace:last_brace + 1]

        ads_copy_result = json.loads(clean_json)
        return sanitize_ads_copy(ads_copy_result)
    except json.JSONDecodeError as e:
        print(f"\n[System Error] Failed to parse JSON from LLM: {e}")
        return {"raw_response": full_content}
