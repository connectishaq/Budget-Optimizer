# Portuguese (pt) — translation notes

Target: Brazilian Portuguese (pt-BR), informal-polite "você" form throughout, as usual for Brazilian consumer apps.
Plural categories (from `Intl.PluralRules('pt')`): `one`, `many`, `other`. `many` only applies to compact/very large
numbers (e.g. 1 milhão), so it uses the same text as `other` everywhere.

## Needs professional review before launch
- `privacy.*`, `terms.*` and `layout.footer.disclaimer.*` are legal text, translated faithfully but not by a lawyer.
  They need a professional review before launch.
- Law names: GDPR is rendered as "Regulamento Geral sobre a Proteção de Dados da UE e do Reino Unido (RGPD/GDPR)";
  CCPA as "Lei de Privacidade do Consumidor da Califórnia (CCPA/CPRA)"; India's DPDP Act as "Lei de Proteção de Dados
  Pessoais Digitais da Índia de 2023 (Digital Personal Data Protection Act)". The English text does not mention
  Brazil's **LGPD** (Lei nº 13.709/2018); since pt targets Brazil, the reviewer may want to add it to the English source
  first (not added here, as translations must not add content). The local authority equivalent to the ICO is the ANPD.
- "Warranty" phrases: "no estado em que se encontra" / "conforme disponível" are the usual Brazilian renderings of
  "as is" / "as available".

## Terms and choices worth checking
- **APR**: Brazil does not use "APR". `inputs.debts.apr` is "Taxa de juros anual (% a.a.)"; `help.text.debtApr` and the
  glossary use "taxa de juros anual". "CET" (Custo Efetivo Total) was rejected because it also includes fees.
- **Take-home pay** → "salário líquido"; **emergency fund** → "reserva de emergência"; **nice-to-haves** → "gastos não
  essenciais"; **must-pay bills** → "contas obrigatórias"; **health score** → "nota de saúde (financeira)".
- **Rent or mortgage** → "Aluguel ou financiamento" (in Brazil a mortgage is normally "financiamento imobiliário").
- **Property tax** → "IPTU" (Brazilian municipal property tax) in `rules.rentBurden.*`.
- **Mortgage insurance** (`rules.rentBurden.tips.ownerInsurance`): Brazilian home loans have mandatory MIP/DFI insurance
  that can't simply be dropped at 20% equity; translated as "veja se dá para reduzir ou tirar…" to stay truthful.
  Reviewer may prefer a different tip.
- **Renter's insurance** (`inputs.fields.homeIns`) → "Seguro residencial ou fiança" (fiança = rental guarantee
  insurance, the closest common renter cost). Could be just "Seguro residencial".
- **Excess / deductible** → "franquia".
- **Toll tag** → "tag de pedágio" (Sem Parar/ConectCar style). **Wholesale market** → "atacarejo".
- **Lentils** in the bulk-staples tip were replaced with "feijão" (beans), the Brazilian staple equivalent.
- **Units used** on the electricity bill → "consumo em kWh".
- **Household help (maid, cook, driver)** → "diarista, cozinheira, motorista".
- **Committee payment** (South Asian rotating savings, `help.text.other`) → "consórcio" (closest Brazilian concept;
  not identical).
- **Eid bonus** placeholder (`inputs.extras.placeholder`) → "Bônus de fim de ano" (more familiar in Brazil). Festival
  names (Eid, Diwali) in preset labels were kept; "Christmas" → "Natal".
- **Holiday** (vacation) → "Férias"/"viagem".
- `profiles.single.name` "Single City Renter" → "Solteiro que aluga na cidade" (masculine generic); group →
  "quem aluga na cidade" so that "Para {group}, …" reads naturally.
- `dashboard.categories.basisIncome`: "compared with a typical {profile}" → "comparada com o perfil típico: {profile}"
  to avoid gender agreement with the profile name.
- `months.status.saved`: "last update {time}" → "última atualização às {time}" — assumes {time} is a clock time.
- `backup.imported.*Dropped`: rephrased as "…; ficaram de fora: {dropped}" to avoid singular/plural agreement with
  {dropped}.

## Payday ordinals
- `payday.dayOfMonth` = "Dia {day}{suffix} do mês" and all `payday.ordinal.*` = "º", as requested for now. Brazilians
  write "Dia 1º" but normally "Dia 15" (no ordinal) for other days, so "Dia 15º" looks slightly odd; these keys are due
  to be reworked to locale ordinals. `page.payday.dayLabel` "Meu salário cai no" is followed by that select, which
  reads "Meu salário cai no Dia 15º do mês" — acceptable, but the label + option could be reworded together later.

## Numbers in the article
- The money-tips article (`page.guide.*`), glossary and FAQ keep the English figures exactly as written ($3,000,
  $46,000, 100,000, °F with °C), because the guide says not to change numbers. A Brazilian reader would expect
  "R$", "100.000" separators and °C only; consider localising those figures in a later pass.

## Possibly long strings (small buttons / tabs)
- `page.results.nav.planAhead` "Planejar" and `nav.payday` "Pagamento" were shortened to fit tabs.
- `inputs.chips.tapToAdd` "Toque para adicionar", `page.share.makeLink` "Criar link para compartilhar",
  `backup.share.dialog.confirm` "Carregar orçamento compartilhado", `reset.deleteAll.backupFirst`
  "Baixar backup antes" are ~30–60% longer than the English.
- `inputs.fields.homeHelp` "Ajuda doméstica (diarista, cozinheira, motorista)" and `inputs.fields.other` "Qualquer outra
  coisa que você paga todo mês" are long field labels.
- Plural/tip sentences in `calc.health.tip.*` are about 20% longer than English.

## Source changes noticed during translation
- After the frozen snapshot, `en.json` changed `charts.returns.*.label` to start with "{pct}%" instead of a fixed
  number; pt was updated to match ("{pct}%: Aplicação segura" etc.), so the pt file follows current en for these 4 keys.
- New `layout.locale.*` keys (4) in en.json were not translated (left for the later pass).
