import { describe, it, expect } from "vitest";
import { hasImageEditReferences, taskTemplateParams, firstReferenceImage, collectReferenceImageUrls } from "./taskParams";

// 「接入即验证」的零额度一环：在不真跑、不花额度的前提下，核对"摊平给模板的参数"是否完整、类型对。
// 这些坑都只在真实参数构建里暴露（实测）：① duration 是数字被 firstString 吞成 ""；
// ② omni 参考数组该不该进 params；③ generate_audio 布尔值该原样保留。

describe("taskTemplateParams — 时长类型", () => {
  it("数字时长原样保留（修复点：number 5 不再被吞成空串）", () => {
    expect(taskTemplateParams({ extras: { duration: 5 } }).duration).toBe(5);
  });
  it("字符串时长 trim 后保留；缺省为空串", () => {
    expect(taskTemplateParams({ extras: { duration: " 8 " } }).duration).toBe("8");
    expect(taskTemplateParams({ extras: {} }).duration).toBe("");
  });
  it("durationSeconds / videoDuration 兜底", () => {
    expect(taskTemplateParams({ extras: { durationSeconds: 10 } }).duration).toBe(10);
  });
});

describe("taskTemplateParams — 档案参考输入（omni）", () => {
  it("archetypeInput 的 reference_image_urls 透传进 params（数组），generate_audio 布尔原样", () => {
    const params = taskTemplateParams({
      extras: {
        archetypeInput: { reference_image_urls: ["a.png", "b.png"] },
        generate_audio: true,
        resolution: "720p",
      },
    });
    expect(params.reference_image_urls).toEqual(["a.png", "b.png"]);
    expect(params.generate_audio).toBe(true);
    expect(params.resolution).toBe("720p");
  });
  it("无 archetypeInput → 不凭空造参考键", () => {
    const params = taskTemplateParams({ extras: { resolution: "1080p" } });
    expect(params).not.toHaveProperty("reference_image_urls");
  });
  it("archetypeInput.input_urls → chat_image_parts 含参考图（修图生图静默退化纯文生）", () => {
    const params = taskTemplateParams({
      extras: {
        archetypeInput: {
          model: "gpt-image-2-image-to-image",
          input_urls: ["nomi-local://asset/p/a.png", "https://cdn/b.png"],
        },
      },
    });
    expect(params.chat_image_parts).toEqual([
      { type: "image_url", image_url: { url: "nomi-local://asset/p/a.png" } },
      { type: "image_url", image_url: { url: "https://cdn/b.png" } },
    ]);
    expect(params.image_url).toBe("nomi-local://asset/p/a.png");
  });
  it("档案 model enum 不算参考图，不污染 chat_image_parts", () => {
    const params = taskTemplateParams({
      extras: { archetypeInput: { model: "gpt-image-2-image-to-image", generation_type: "edit" } },
    });
    expect(params.chat_image_parts).toEqual([]);
  });
});

describe("collectReferenceImageUrls — wire 与护栏同源", () => {
  it("从 input_urls 收集（档案 gpt-image-2 口径）", () => {
    expect(
      collectReferenceImageUrls({ input_urls: ["https://x/a.png", "https://x/b.png"] }),
    ).toEqual(["https://x/a.png", "https://x/b.png"]);
  });
  it("去重保序", () => {
    expect(
      collectReferenceImageUrls({
        input_urls: ["https://x/a.png"],
        reference_images: ["https://x/a.png", "https://x/b.png"],
      }),
    ).toEqual(["https://x/a.png", "https://x/b.png"]);
  });
});

describe("firstReferenceImage — 单图首选", () => {
  it("按 image_url → imageUrl → firstFrameUrl → lastFrameUrl → referenceImages[0] 顺序取第一个非空", () => {
    expect(firstReferenceImage({ extras: { firstFrameUrl: "f.png" } })).toBe("f.png");
    expect(firstReferenceImage({ extras: { referenceImages: ["r.png"] } })).toBe("r.png");
    expect(firstReferenceImage({ extras: {} })).toBe("");
  });
});

describe("hasImageEditReferences — L3 诚实护栏判定（图生图/图生视频是否真带了参考）", () => {
  it("空 extras → false", () => {
    expect(hasImageEditReferences({ extras: {} })).toBe(false);
    expect(hasImageEditReferences({})).toBe(false);
  });
  it("referenceImages（非档案路）→ true", () => {
    expect(hasImageEditReferences({ extras: { referenceImages: ["https://cdn/a.png"] } })).toBe(true);
  });
  it("archetypeInput 只有 model enum + fixedParams（无任何 URL）→ false（enum 不算参考图）", () => {
    expect(hasImageEditReferences({ extras: { archetypeInput: { model: "gpt-image-2-image-to-image", generation_type: "edit" } } })).toBe(false);
  });
  it("archetypeInput.input_urls → true（gpt-image-2 i2i 口径）", () => {
    expect(hasImageEditReferences({ extras: { archetypeInput: { model: "gpt-image-2-image-to-image", input_urls: ["nomi-local://asset/p/a.png"] } } })).toBe(true);
  });
  it("volcengine content 项（嵌套 {image_url:{url}}）→ true", () => {
    expect(hasImageEditReferences({ extras: { archetypeInput: { volcengine_image_contents: [{ type: "image_url", image_url: { url: "https://cdn/a.png" }, role: "reference_image" }] } } })).toBe(true);
  });
  it("extras.image 裸键（headless/老调用方）→ true", () => {
    expect(hasImageEditReferences({ extras: { image: "https://cdn/first.png" } })).toBe(true);
  });
  it("firstFrameUrl 单图口径 → true", () => {
    expect(hasImageEditReferences({ extras: { firstFrameUrl: "https://cdn/f.png" } })).toBe(true);
  });
});
