import json
from app.shared.agents.scan_project.llm_ad_generator import generate_ads_from_insights

# Dữ liệu mẫu dùng để chạy thử
mock_data = {
    "website": "https://blofin.com",
    "domain": "blofin.com",
    "project_name": "BloFin",
    "project_link": "https://blofin.com",
    "event_content": "BloFin Futures Trading Grand Prix with up to 100,000 USDT prize pool.",
    "sale_content": "Get up to 5,000 USDT welcome bonus for new users upon registration.",
    "restricted_countries": [
        {"country": "United States", "restriction_type": "banned"},
        {"country": "United Kingdom", "restriction_type": "restricted"}
    ],
    "top_countries": [
        {"country": "Vietnam", "signal_score": 10},
        {"country": "South Korea", "signal_score": 8}
    ],
    "answer": "BloFin is a cryptocurrency exchange platform specializing in futures trading, copy trading, and offering secure digital asset management services.",
    "results": [
        {
            "title": "BloFin - Crypto Services & Futures Trading",
            "content": "BloFin offers professional crypto futures trading, secure wallet services, and copy trading features with high liquidity."
        },
        {
            "title": "BloFin VIP & Rewards Program",
            "content": "New registered users can join VIP program to get fee discounts and referral bonuses."
        }
    ]
}

if __name__ == "__main__":
    print("--- CHẠY THỬ GENERATE ADS BẰNG MINIMAX-M3 (Sử dụng module llm_ad_generator) ---")
    try:
        result = generate_ads_from_insights(
            project_data=mock_data,
            language="English",
            custom_requirements="Tránh các từ cam kết lợi nhuận, giữ ngôn ngữ trung lập."
        )
        print("\n=== KẾT QUẢ THÀNH CÔNG ===")
        print(json.dumps(result, indent=2, ensure_ascii=False))
    except Exception as exc:
        print(f"\n[LỖI] Không thể chạy thử: {exc}")
