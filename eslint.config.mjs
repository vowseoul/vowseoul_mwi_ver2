import nextConfig from "eslint-config-next";

const eslintConfig = [
  ...nextConfig,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "supabase/migrations/**",
      "scripts/**",
      // shadcn/ui 생성 컴포넌트 — 직접 수정하지 않는 벤더성 코드라 린트 노이즈 제외
      "components/ui/**",
    ],
  },
];

export default eslintConfig;
