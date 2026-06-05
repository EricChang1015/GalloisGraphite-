# Legacy Content (from madagraphite.com)

> 來源:<http://madagraphite.com/>（英文版為預設首頁）
> 同站語言切換支援 English / 简体中文 / Français / 日本語。
> 之後做 i18n 時可從舊站各語系頁面抽取對應翻譯。

## 公司關鍵資訊

- **法人**: Etablissements Gallois S.A. (Graphite Energy Inc. 為當前營運方/銷售代理)
- **歷史**: 1901 年由 Gallois 家族建立,持續生產逾 120 年
- **2016 年**: 新營運方接手,大規模引入現代化設備
- **產量**: 從不到 5,000 噸 / 年提升至 2017 年 60,000 噸,2020 年 No.1 + No.2 兩個礦區合計約 140,000 噸 / 年(全球前列)
- **儲量**: 已探明約 240 百萬噸石墨,僅探明礦區面積 < 1%
- **位置**: 馬達加斯加東北部 Tamatave 省
  - Madagascar office: Boulevard de l'Ivondro, Cité Canada, Toamasina 501, Madagascar
  - 距 Tamatave 國際港僅 45 km
- **電話**:
  - Head office: +853 66-516-516
  - Chinese Hot Line: +86 0532-68680029
- **Email**: sales@madagraphite.com / richard@madagraphite.com
- **氣候**: 全年 15-35°C,水資源豐富,可全年不間斷生產

## 礦區

| 礦區 | 名稱 | 狀態 |
|---|---|---|
| No.1 | Antsirakambo | 開採中 (規劃年產 ~80,000 噸) |
| No.2 | Marovintsy | 開採中 (規劃年產 ~60,000 噸) |
| No.3 | Ambalafotaka | 尚未開採 |

- 總面積 280 平方公里
- 礦石平均碳含量約 10%(全球罕見高)
- 露天開採,作業安全
- 浮選後即可達到高碳含量

## 產品品牌

### MADA1
- 結晶結構完整、密度高、灰分中不利純化的成分極低
- 主要用途:
  - 鋰電池球形石墨
  - 可膨脹石墨 (Expandable graphite)
  - 高純石墨
  - 軍工 / 航太用石墨
  - 人造金剛石
  - 高級耐火材料

### MADA2
- 主要用途:
  - 冶金 (Metallurgy)
  - 耐火材料 (Refractories)
  - 坩堝 (Crucibles)
  - 高純石墨原料

## 標準規格表

平台 `product_categories` 種子資料應包含以下品類:

| GRADE | FIXED CARBON | SIZE | MOISTURE |
|---|---|---|---|
| +35 MESH | 75-99% | +35MESH 80% MIN | 0.5% MAX |
| +50 MESH | 75-99% | +50MESH 80% MIN | 0.5% MAX |
| +80 MESH | 75-99% | +80MESH 80% MIN | 0.5% MAX |
| +100 MESH | 75-99% | +100MESH 80% MIN | 0.5% MAX |
| +150 MESH | 75-99% | +150MESH 80% MIN | 0.5% MAX |
| -100 MESH | 75-99% | -100MESH 80% MIN | 0.5% MAX |

> 「除以上標準等級外,可依客戶需求客製規格」

碳含量範圍:80% – 99%
篩網規格:+32 / +50 / +80 / +100 / +150 / -100 mesh

## 主要客戶區域

歐洲、美國、英國、中國、俄羅斯、日本、韓國、印度、土耳其、巴西、墨西哥
(全球碳產業客戶)

## 應用範圍

- 鋰電池(Li-ion battery)負極材料 — 球形石墨
- 可膨脹石墨 (Expandable graphite, intumescent / fire-proofing)
- 高純石墨 (High-purity graphite)
- 耐火材料 (Refractories)
- 冶金 / 坩堝 (Metallurgy / Crucibles)
- 密封材料 / 剎車片 / 鉛筆等
- 軍工、航太、人造金剛石

## 圖片資產(舊站可借用)

已從 <http://madagraphite.com/> 匯入至 `public/images/legacy/`:
```
public/images/legacy/
  ├── map_a.png / map_b.png / map_c.png       # 礦區地圖
  ├── mada_logo_a.png / mada_logo_b.png        # 品牌 logo
  └── mining/header/1..6.jpg                   # 礦區照片
```

> ⚠️ 上線前請確認版權允許再用;不確定時改用 picsum / 自行拍攝。

## Hero 文案建議(MVP 首頁)

> First Class Natural Flake Graphite from Madagascar — Trusted Globally Since 1901.
>
> Connecting global buyers with the most productive graphite mine in the world,
> backed by Graphite Energy Inc. From inquiry to delivery, securely on one
> AI-powered platform.

## SEO Keywords (從舊站抽取)

```
Global sales of graphite, Madagascar graphite, Flake Graphite Mine,
Expandable graphite, High purity graphite, Spherical graphite, Graphite
```

## Description (從舊站 meta description 抽取)

> Exclusive sales agent of Etablissements Gallois S.A., aiming for global
> markets. The Gallois mine has been producing first class graphite. Gallois
> main trademarks: Mada1, mainly used in the production of expandable
> graphite, high purity graphite, spherical graphite, etc. Mada2, mainly used
> in applications like metallurgy and refractories, crucibles as well as a
> raw material for the production of high purity graphite, etc.

## i18n 預設語言對應(舊站)

| 語系 | 舊站 (<http://madagraphite.com/>) | 新站 locale |
|---|---|---|
| English | 預設首頁 | `en` |
| 简体中文 | 語言切換 | `zh-CN` |
| Français | 語言切換 | `fr` |
| 日本語 | 語言切換 | `ja` |
