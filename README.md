# NourishNet
# 🍲 NourishNet: Predictive Surplus Logistics & Food Rescue Engine

![UN SDG 2](https://img.shields.io/badge/UN_SDG-2_Zero_Hunger-e5243b?style=for-the-badge)
![UN SDG 12](https://img.shields.io/badge/UN_SDG-12_Responsible_Consumption-bf8b2e?style=for-the-badge)
![UN SDG 13](https://img.shields.io/badge/UN_SDG-13_Climate_Action-3f7e44?style=for-the-badge)
![UN SDG 11](https://img.shields.io/badge/UN_SDG-11_Sustainable_Cities-fd9d24?style=for-the-badge)

**NourishNet** eliminates inventory logging friction and cold-chain delays by turning a single smartphone photo of leftover trays into a verified, routed logistics dispatch within 30 seconds.

---

## ⚠️ The Problem

- **Small Scale (Local):** Campus canteens, event caterers, and local restaurants throw away kilos of edible food nightly. Manually listing items, assessing safety windows, and coordinating volunteer pickups takes too much time during closing hours.
- **Large Scale (Systemic):** Roughly one-third of global food production is wasted, generating massive methane emissions in landfills while millions face acute nutritional deficits.

## 💡 The Solution

NourishNet bridges the gap between surplus food and those in need using automated computer vision and optimized logistics. Instead of filling out forms, vendors simply snap a photo. 

### Core Architecture

1. **Vision-to-Schema Pipeline:** 
   Vendors snap a photo of leftover food trays or raw ingredients. A multimodal Vision-LLM identifies the food type, estimates quantity/portions, and calculates a perishable safety window based on ambient local weather data.
2. **Automated Dispatch Engine:** 
   A lightweight **FastAPI** backend runs a constraint-satisfaction algorithm matching perishable urgency against the real-time capacity and distance of registered local NGOs or community fridges.
3. **Zero-App Volunteer Bot:** 
   A WhatsApp/Telegram bot pushes instant claim links and optimized multi-stop pickup routes to student volunteers, eliminating the need for them to download a dedicated app.

## 🎯 Targeted UN SDGs

- **SDG 2 (Zero Hunger):** Directly channels high-nutrition surplus to vulnerable populations.
- **SDG 12 (Responsible Consumption and Production):** Drastically cuts commercial and institutional food waste.
- **SDG 13 (Climate Action):** Prevents organic waste from decomposing into methane in municipal landfills.
- **SDG 11 (Sustainable Cities and Communities):** Builds resilient, decentralized urban food-sharing networks.

## 🚀 Getting Started

### Prerequisites
* Python 3.10+
* Uvicorn
* Telegram/WhatsApp API Keys
* Vision-LLM API Key (e.g., OpenAI/Gemini)

### Credits
1. Sangram Keshari Patra
2. Rwitabrato Hanpal
3. Shiaditya Mandal