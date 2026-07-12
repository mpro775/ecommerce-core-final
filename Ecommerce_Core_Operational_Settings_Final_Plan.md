# التقرير النهائي لإعدادات التشغيل وخطة تنظيف نواة المتجر

## الهدف العام

تحويل المشروع إلى:

> **محرك تجارة إلكترونية ثابت، مع لوحة تشغيل وإدارة كاملة، وليس منشئ متاجر أو نظام قوالب وتخصيص مظهر.**

كل عميل يحصل على نسخة مستقلة، وأي تخصيص في الهوية أو التصميم يتم داخل كود الواجهة والتطبيق، وليس من خلال لوحة التحكم.

---

# أولًا: الحكم العام على إعدادات التشغيل الحالية

جدول:

```text
store_general_settings
```

يحتوي على:

```text
profile_settings
currency_settings
order_settings
inventory_settings
tax_settings
mobile_app_config
```

لكن معظم هذه الحقول حاليًا:

- تُحفظ في JSON.
- تُعاد من API.
- يمكن إرسالها يدويًا إلى `PUT /store/settings`.
- لكنها لا تُقرأ داخل Checkout أو الطلبات أو المخزون.
- لا تؤثر فعليًا في منطق البيع.
- بعض الحقول لا تظهر أصلًا في لوحة التحكم.
- بعض الأنظمة لها مصادر حقيقة منفصلة ومربوطة فعليًا، مثل العملات وطرق الدفع والشحن والولاء.

بالتالي فإن جزءًا كبيرًا من الإعدادات الحالية هو:

> **تخزين وإظهار API دون ربط منطقي حقيقي بالتجارة الإلكترونية.**

---

# ثانيًا: تقييم كل إعداد تشغيلي

## 1. العملة الافتراضية

### الحالة

**مربوطة فعليًا، لكن الربط غير موحد بالكامل.**

الموجود فعليًا:

- جدول `store_currencies`.
- أسعار صرف مقابل الريال اليمني.
- عملة افتراضية.
- العملة تُستخدم في السلة وCheckout والطلب.
- يتم حفظ:
  - `currency_code`
  - `exchange_rate_yer_per_unit`
  - القيم الأصلية.
  - القيم المحولة إلى YER.

### التعارضات

يوجد تكرار بين:

```text
stores.currency_code
stores.default_currency_code
store_currencies
currency_settings
```

كما أن الطلبات اليدوية من لوحة التحكم تُنشأ دائمًا بالعملة:

```ts
currencyCode: 'YER'
exchangeRateYerPerUnit: 1
```

بغض النظر عن العملة الافتراضية.

### القرار

الاحتفاظ بـ:

```text
store_currencies
stores.default_currency_code
```

وحذف إعدادات العملة المكررة من `store_general_settings`.

ويجب تعديل الطلب اليدوي ليستخدم:

- العملة الافتراضية.
- أو العملة التي يختارها الموظف.

---

## 2. المنطقة الزمنية

### الحالة

**مربوطة جزئيًا.**

الحقل:

```text
stores.timezone
```

يُستخدم فعليًا في:

- بداية اليوم.
- نهاية اليوم.
- الفترات الزمنية.
- التحليلات.
- التقارير.

لكنه لا يُستخدم بصورة موحدة في:

- جدولة الإشعارات.
- التنبيهات اليومية.
- مهلة الدفع.
- تواريخ الفواتير المعروضة.
- انتهاء الطلبات غير المدفوعة.
- الملخصات اليومية.

### القرار

الإبقاء عليه، مع إنشاء خدمة مركزية:

```ts
StoreClockService
```

تستخدمها:

- التحليلات.
- الفواتير.
- العمال المجدولون.
- الإشعارات اليومية.
- سياسات الإلغاء والإرجاع.

تبقى جميع التواريخ مخزنة في PostgreSQL بصيغة UTC، ويتم التحويل عند العرض والحساب.

---

## 3. الضريبة

### الحالة

**تخزين فقط وغير مربوطة بالحسابات.**

يوجد:

```text
taxSettings.enabled
taxSettings.defaultRate
taxSettings.priceMode
taxSettings.exemptions
taxSettings.categoryRates
taxSettings.taxNumber
```

كما توجد داخل المنتجات حقول:

```text
is_taxable
tax_rate
```

لكن Checkout لا يحسب الضريبة.

ولا توجد في الطلبات حقول فعلية مثل:

```text
tax_total
tax_total_yer
```

ولا تحفظ عناصر الطلب:

```text
tax_rate_snapshot
tax_amount
price_before_tax
price_after_tax
```

### القرار

إكمالها بشكل حقيقي من خلال:

- تحديد هل المنتج خاضع للضريبة.
- دعم معدل افتراضي.
- دعم معدل خاص بالمنتج.
- حساب الضريبة على مستوى كل عنصر.
- حفظ Tax Snapshot مع الطلب.
- إدخال الضريبة في Quote وCheckout والفاتورة.

---

## 4. هل الأسعار تشمل الضريبة؟

### الحالة

**تخزين فقط.**

القيمة الحالية:

```text
priceMode = inclusive | exclusive
```

لا تدخل في أي معادلة تسعير.

### الربط المطلوب

عند `inclusive`:

```text
السعر المعروض شامل الضريبة
صافي السعر = السعر ÷ (1 + معدل الضريبة)
```

عند `exclusive`:

```text
الإجمالي = السعر + الضريبة
```

ويجب أن يعطي:

```text
GET /app/checkout/quote
POST /app/checkout
```

النتيجة نفسها تمامًا.

---

## 5. الحد الأدنى للطلب

### الحالة

**تخزين فقط.**

الحقل:

```text
orderSettings.minimumOrderValue
```

غير مستخدم خارج إعدادات المتجر.

لا يمنع:

- إتمام طلب أقل من الحد.
- إنشاء طلب يدوي أقل من الحد.
- احتساب Checkout Quote أقل من الحد.

### الربط المطلوب

إنشاء خدمة مشتركة:

```ts
CheckoutRulesService.assertMinimumOrder()
```

وتطبيقها على:

- Quote.
- Checkout.
- الطلب اليدوي، مع إمكانية تجاوز الموظف بصلاحية خاصة.

ويحسب الحد على:

> قيمة المنتجات بعد الخصومات وقبل الشحن.

---

## 6. ترقيم الطلبات والفواتير

### الحالة

**ترقيم الطلبات موجود، لكن الإعداد غير مربوط. الفواتير غير موجودة.**

الحقل:

```text
orderSettings.orderNumberPrefix
```

لا يُستخدم.

الكود الفعلي ينشئ أرقامًا عشوائية مثل:

```text
KS-A1B2C3
```

كما لا يوجد نظام فواتير بيع متكامل.

### القرار

إنشاء جدول:

```text
document_sequences
```

ويحتوي على:

```text
store_id
document_type
prefix
next_value
padding
updated_at
```

والأنواع:

```text
order
invoice
return
refund
```

ويتم التوليد داخل Transaction باستخدام:

```sql
SELECT ... FOR UPDATE
```

فتصبح الأرقام مثل:

```text
ORD-000001
INV-000001
RET-000001
REF-000001
```

---

## 7. سياسة إلغاء الطلب

### الحالة

**تخزين فقط.**

الحقول:

```text
allowOrderCancellation
cancellationWindowMinutes
```

لا تؤثر على النظام.

### الربط المطلوب

إضافة:

```text
POST /app/orders/:orderCode/cancel
```

مع:

- التحقق من هوية صاحب الطلب.
- التحقق من `allowOrderCancellation`.
- التحقق من عمر الطلب.
- التحقق من الحالة الحالية.
- تحرير الحجز أو استعادة المخزون.
- إلغاء الدفع المعلق عند الحاجة.
- تسجيل السبب في Timeline.
- إصدار Outbox Event.

وتكون صلاحية الموظف في تجاوز المهلة منفصلة.

---

## 8. مهلة الدفع

### الحالة

**غير موجودة.**

لا يوجد حاليًا:

```text
paymentTimeoutMinutes
paymentDueAt
autoCancelUnpaidOrders
```

وقد تبقى المدفوعات اليدوية معلقة بلا نهاية.

### الربط المطلوب

إضافة:

```text
payment_timeout_minutes
auto_cancel_unpaid_orders
```

وحقل:

```text
payment_due_at
```

ثم Worker مجدول يقوم بـ:

1. العثور على الطلبات مسبقة الدفع المنتهية.
2. تغيير الدفع إلى `expired`.
3. إلغاء الطلب إذا كانت السياسة تسمح.
4. تحرير المخزون.
5. إرسال إشعار.
6. استثناء الدفع عند الاستلام.

---

## 9. مدة حجز المخزون

### الحالة

**نظام الحجز فعلي، لكن إعداد قاعدة البيانات غير مربوط.**

الحقل:

```text
inventorySettings.reservationTtlMinutes
```

لا يستخدم.

الكود يقرأ مباشرة:

```text
INVENTORY_RESERVATION_TTL_MINUTES
```

من Environment.

### القرار

- حذف القراءة المباشرة المكررة من `process.env`.
- قراءة القيمة من إعدادات المخزون.
- تمرير Settings Snapshot إلى Transaction.
- الإبقاء على Environment كقيمة افتراضية وقت إنشاء المتجر فقط.

---

## 10. بيانات الفاتورة

### الحالة

**غير موجودة.**

لا توجد فاتورة بيع حقيقية تشمل:

- رقم فاتورة.
- اسم المنشأة القانوني.
- العنوان القانوني.
- الرقم الضريبي.
- بيانات البائع والمشتري.
- تفاصيل الضريبة.
- تاريخ الإصدار.
- حالة الفاتورة.
- PDF أو HTML.
- فاتورة مرتجع أو إشعار دائن.

### الربط المطلوب

إنشاء:

```text
store_invoice_settings
invoices
invoice_items
```

وتحفظ الفاتورة Snapshot مستقلة عن بيانات المتجر الحالية.

---

## 11. طرق الدفع المفعلة

### الحالة

**مربوطة فعليًا بصورة صحيحة.**

النظام يحتوي على:

```text
payment_method_catalog
store_payment_methods
```

والربط يشمل:

- تفعيل وتعطيل الطريقة.
- إخفاء المعطلة من الواجهة.
- رفض Checkout إذا اختار العميل طريقة معطلة.
- حفظ Snapshot لبيانات الحساب.
- تحديد هل يلزم مرجع.
- تحديد هل يلزم إيصال.
- الدفع عند الاستلام.
- التحويلات اليدوية.

### القرار

تبقى:

```text
store_payment_methods
```

هي مصدر الحقيقة الوحيد.

ولا توضع طرق الدفع مرة أخرى داخل جدول إعدادات التشغيل.

---

## 12. إعدادات الشحن

### الحالة

**مربوطة فعليًا بالتسعير وCheckout، لكنها لا تمثل دورة شحنة كاملة.**

الموجود فعليًا:

- مناطق التوصيل.
- طرق التوصيل والاستلام.
- التسعير الثابت.
- التسعير حسب الوزن أو النطاقات.
- الشحن المجاني المشروط.
- اختيار الطريقة في Checkout.
- حفظ طريقة الشحن ورسومها كـSnapshot في الطلب.

غير الموجود:

- إنشاء شحنة تشغيلية.
- رقم تتبع.
- شركة شحن.
- بوليصة شحن.
- أحداث الشحنة.
- Webhooks لشركة الشحن.

### القرار

الإبقاء على جداول الشحن الحالية كمصدر الحقيقة:

```text
shipping_zones
shipping_methods
shipping_method_ranges
```

ولا تكرر داخل `store_general_settings`.

---

## 13. بيانات التواصل التشغيلية

### الحالة

**مربوطة جزئيًا للعرض فقط.**

الهاتف والعنوان وساعات العمل تظهر في:

- Public Store Config.
- بيانات المتجر العامة.
- SEO المولد.
- واجهة المتجر.

لكنها لا تتحكم في:

- استقبال الطلبات.
- استقبال التنبيهات.
- إرسال الإشعارات.
- قنوات الدعم.
- بيانات الفاتورة بصورة منفصلة.

### القرار

فصل الحقول التالية:

```text
support_phone
support_email
order_notifications_email
technical_alerts_email
```

---

## 14. البريد الذي تصله الطلبات والتنبيهات

### الحالة

**غير موجود منطقيًا.**

لا يوجد إعداد يحدد مستلم:

- الطلبات الجديدة.
- إثباتات الدفع.
- المخزون المنخفض.
- تذاكر الدعم.
- الأخطاء التشغيلية.

### الربط المطلوب

إنشاء جدول:

```text
notification_recipients
```

ويحتوي على:

```text
store_id
event_group
channel
destination
is_enabled
```

ومجموعات مثل:

```text
orders
payments
inventory
support
system
```

---

## 15. إعدادات OTP

### الحالة

**غير مربوطة بصورة صحيحة.**

توجد Environment Variables مثل:

```text
AUTH_OTP_TTL_MINUTES
AUTH_OTP_MAX_VERIFY_ATTEMPTS
AUTH_OTP_RESEND_COOLDOWN_SECONDS
AUTH_OTP_MAX_RESEND_COUNT
```

لكن الكود يستخدم أرقامًا ثابتة، ويطبع الرمز في Console.

### القرار

إنشاء:

```text
store_auth_settings
```

ويحتوي على:

```text
otp_login_enabled
otp_registration_enabled
otp_auto_register
otp_ttl_minutes
otp_max_attempts
otp_resend_cooldown_seconds
otp_max_resends
```

أما أسرار SMS وEmail Provider فتبقى في Environment.

---

## 16. إعدادات الإشعارات

### الحالة

**مربوطة جزئيًا.**

المربوط فعليًا:

- Inbox داخل لوحة التحكم.
- WebSocket للأحداث الفورية.
- قراءة الإشعارات.
- عدد غير المقروء.
- كتم إشعارات Inbox.
- اختيار:
  - `instant`
  - `daily_digest`
  - `mute`

لكن:

- `daily_digest` لا يتم إرساله فعليًا.
- قناة البريد يمكن تخزينها دون Dispatcher حقيقي.
- إعدادات البريد لا تحدد عنوان المستلم.
- بعض الأحداث القديمة ما زالت موجودة.

### القرار

- إضافة Email Dispatcher.
- إضافة Daily Digest Worker.
- ربط المستلمين بـ`notification_recipients`.
- تنظيف الأحداث القديمة.
- جعل التفضيلات تؤثر فعليًا في جميع القنوات.

---

## 17. حد المخزون المنخفض

### الحالة

**الحد على مستوى المنتج أو المستودع فعلي، أما الحد العام فغير مربوط.**

الإشعارات الفعلية تعتمد على:

```text
product_variants.low_stock_threshold
warehouse_inventory.low_stock_threshold
```

أما:

```text
inventorySettings.lowStockAlertThreshold
```

فلا يستخدم.

### القرار

تحويله إلى:

```text
default_low_stock_threshold
```

ويستخدم فقط كقيمة افتراضية عند إنشاء Variant أو ربطه بمستودع.

---

## 18. سياسة نقاط الولاء

### نص سياسة الولاء

```text
loyaltyPolicy
```

**للعرض فقط ولا يؤثر في الحسابات.**

### نظام الولاء الحقيقي

النظام الحالي يدعم:

- معدل الكسب.
- الحد الأدنى للطلب.
- معدل الاستبدال.
- الحد الأدنى للاستبدال.
- الحد الأقصى للخصم.
- محفظة النقاط.
- Ledger.
- اكتساب النقاط.
- عكس النقاط.
- الاستبدال في Checkout.

لكن توجد حقيقتان مختلفتان لتفعيل الولاء:

```text
mobile_app_config.enabledFeatures
loyalty_programs.is_enabled
```

### القرار

حذف Feature Gate القديم.

والمصدر الوحيد لتفعيل الولاء هو:

```text
loyalty_programs.is_enabled
```

---

## 19. إعدادات الطلبات والمرتجعات

### الطلبات

نظام الطلبات نفسه فعلي ويشمل:

- إنشاء الطلب.
- عناصر الطلب.
- الحالات.
- Timeline.
- الدفع.
- الشحن.
- الخصومات.
- المخزون.
- الولاء.
- العمولات.
- Webhooks.

لكن إعدادات الطلب العامة لا تتحكم فيه فعليًا.

### المرتجعات

الحالة الحالية مرتبطة جزئيًا فقط.

يوجد Status:

```text
returned
```

وعند الانتقال إليه:

- تتم استعادة المخزون.
- تعكس نقاط الولاء.
- تعالج العمولة.

لكن لا يوجد:

- طلب إرجاع.
- عناصر وكميات مرتجعة.
- إرجاع جزئي.
- قبول ورفض.
- صور.
- أسباب.
- فحص المنتج.
- Refund مستقل.
- تطبيق `allowReturns`.
- تطبيق `returnWindowDays`.

### القرار

إنشاء:

```text
return_requests
return_items
return_events
refund_transactions
```

---

# ثالثًا: الخلاصة الرقمية

| التصنيف | العدد |
|---|---:|
| مربوط فعليًا بصورة جيدة | 2 |
| مربوط جزئيًا أو متعارض | 8 |
| تخزين فقط | 6 |
| غير موجود أصلًا | 3 |

الإعدادان الأكثر اكتمالًا هما:

- طرق الدفع المفعلة.
- إعدادات الشحن والتسعير.

أما جدول `store_general_settings` فمعظمه ليس مصدرًا حقيقيًا للمنطق التشغيلي.

---

# رابعًا: الهيكل النهائي المقترح للإعدادات

## جدول المتجر

```text
stores
```

ويحتوي فقط على:

```text
id
name
legal_name
default_currency_code
timezone
support_phone
support_email
order_notifications_email
technical_alerts_email
country
city
address
tax_number
status
created_at
updated_at
```

## إعدادات الطلبات

```text
store_order_settings
```

```text
store_id
minimum_order_value
allow_guest_checkout
allow_customer_cancellation
cancellation_window_minutes
confirmation_mode
auto_cancel_unpaid_orders
payment_timeout_minutes
```

## إعدادات المخزون

```text
store_inventory_settings
```

```text
store_id
allow_out_of_stock_sales
reserve_inventory
reservation_ttl_minutes
default_low_stock_threshold
restore_stock_on_cancellation
warehouse_selection_mode
```

## إعدادات الضريبة

```text
store_tax_settings
```

```text
store_id
is_enabled
default_rate
prices_include_tax
tax_number
```

## إعدادات الفواتير

```text
store_invoice_settings
```

```text
store_id
issue_on_status
seller_legal_name
seller_address
seller_tax_number
footer_text
```

## إعدادات المصادقة

```text
store_auth_settings
```

```text
store_id
otp_login_enabled
otp_registration_enabled
otp_auto_register
otp_ttl_minutes
otp_max_attempts
otp_resend_cooldown_seconds
otp_max_resends
```

## إعدادات تشغيل التطبيق

```text
app_runtime_settings
```

```text
minimum_android_version
minimum_ios_version
force_update
maintenance_mode
maintenance_message
```

ولا يحتوي على:

- ألوان.
- خطوط.
- Themes.
- تخطيط الصفحة.
- إظهار وإخفاء أنظمة التجارة.

---

# خامسًا: مصادر الحقيقة التي يجب عدم تكرارها

## العملات

```text
store_currencies
```

## طرق الدفع

```text
payment_method_catalog
store_payment_methods
```

## الشحن

```text
shipping_zones
shipping_methods
shipping_method_ranges
```

## الولاء

```text
loyalty_programs
loyalty_earn_rules
customer_loyalty_wallets
loyalty_ledger
```

## حد المخزون

```text
product_variants.low_stock_threshold
warehouse_inventory.low_stock_threshold
```

## الإشعارات

```text
notification_preferences
notification_recipients
notifications
notification_deliveries
```

بعد نقل جميع الحقول التشغيلية المطلوبة، يتم حذف:

```text
store_general_settings
```

بالكامل.

---

# سادسًا: الخطة التنفيذية الكاملة

## المرحلة الأولى: تثبيت البنية المستهدفة

### الهدف

تحويل المشروع إلى:

> محرك تجارة إلكترونية ولوحة تشغيل، وليس منشئ متاجر.

### القرارات

- نسخة مستقلة لكل عميل.
- متجر واحد لكل Deployment.
- التصميم داخل كود الواجهة والتطبيق.
- لا Themes.
- لا Page Builder.
- لا إعدادات مظهر.
- لا Subdomain Management.
- لا SaaS Features أو اشتراكات.
- لا Feature Flags مبنية على الباقات.
- لوحة التحكم لإدارة التجارة فقط.

### معيار الإغلاق

وجود وثيقة واضحة تحدد مصدر الحقيقة لكل مجال.

---

## المرحلة الثانية: الإصلاحات الجوهرية الحرجة

### 1. إصلاح Atomic Checkout

إدخال:

```text
order.created outbox event
idempotency completion
```

داخل Transaction إنشاء الطلب.

### 2. إصلاح ترميز الملفات

تحويل الملفات غير UTF-8، خصوصًا:

```text
src/storefront/storefront.service.ts
migrations/037_store_settings_profile_and_location.up.sql
```

وتحديث فحص Mojibake ليكتشف Invalid UTF-8.

### 3. إصلاح الاختبارات

- تحديث اختبارات الأدوار.
- تحديث اختبار Single Store Resolver.
- منع تعليق `npm test`.
- جعل جميع الاختبارات خضراء.

### 4. إصلاح لوحة التحكم

حذف الأجزاء المرتبطة بـ:

- Store Slug Preview.
- Subdomain.
- Onboarding المرئي.
- تخصيص الواجهة.

### 5. تحديث الاعتماديات الحرجة

معالجة ثغرات:

- `multer`
- `nodemailer`
- `xlsx`
- `ws`
- AWS XML dependencies

### معيار الإغلاق

```text
Backend build: PASS
Admin typecheck: PASS
Admin production build: PASS
Tests: PASS
UTF-8 scan: PASS
```

---

## المرحلة الثالثة: حذف الأقسام غير المهمة

### من لوحة التحكم

حذف:

```text
setup
storePages
واجهة المتجر
إعدادات المظهر
slug/subdomain
onboarding visual setup
السياسات ومحرر الصفحات
SEO pages
logo/theme customization
social links as storefront builder
working hours as storefront content
```

حذف أو إعادة بناء:

```text
merchant-onboarding.tsx
panels/setup-panel.tsx
panels/seo/store-pages-panel.tsx
panels/store-settings/store-settings-panel.tsx
```

وتحويل صفحة إعدادات المتجر إلى:

```text
OperationalSettingsPanel
```

### من الباك إند

حذف:

```text
StoreReadinessModule
Store Pages management
Store Slug availability
Visual profile settings
primaryColor
secondaryColor
Mobile display toggles
StoreCapabilities SaaS feature gating
Page publishing workflow
```

تبسيط `SeoModule` ليولد SEO تلقائيًا من:

- اسم المنتج.
- وصف المنتج.
- اسم التصنيف.
- اسم المتجر.

### من قاعدة البيانات

حذف:

```text
store_pages
store_setup_progress
store_setup_step_skips
store_general_settings
stores.seo_settings
stores.onboarding_completed_at
الحقول البصرية غير المطلوبة
```

بعد نقل الحقول التشغيلية المطلوبة.

---

## المرحلة الرابعة: إنشاء طبقة إعدادات تشغيل موحدة

إنشاء Module:

```text
OperationalSettingsModule
```

وتوفير خدمات:

```ts
OrderSettingsService
InventorySettingsService
TaxSettingsService
InvoiceSettingsService
AuthSettingsService
NotificationRoutingService
```

### قواعد التنفيذ

- لا يقرأ أي Domain من JSON عام.
- لا يقرأ أي Service الإعدادات مباشرة من `process.env` إلا أسرار التكامل.
- الإعدادات تقرأ مرة واحدة في بداية العملية وتُمرر كـSnapshot.
- يتم إبطال Cache عند تحديث الإعدادات.
- جميع الإعدادات Typed ومقيدة بقيود قاعدة البيانات.

---

## المرحلة الخامسة: ربط إعدادات الطلبات والعملة

### المطلوب

- تطبيق العملة الافتراضية على الطلب اليدوي.
- إزالة تكرار Currency JSON.
- تطبيق الحد الأدنى للطلب.
- تطبيق Guest Checkout.
- إنشاء ترقيم تسلسلي للطلبات.
- تطبيق Confirmation Mode:
  - `automatic`
  - `manual`
- تطبيق سياسة الإلغاء.
- إضافة مهلة الدفع.
- تخزين Settings Version أو Snapshot مع الطلب.

### معيار الإغلاق

تغيير الإعداد من لوحة التحكم يجب أن يغير نتيجة Checkout فعلًا.

---

## المرحلة السادسة: ربط المخزون والضريبة

### المخزون

- استخدام `reservation_ttl_minutes` من قاعدة البيانات.
- تطبيق `reserve_inventory`.
- تطبيق `allow_out_of_stock_sales`.
- تطبيق `restore_stock_on_cancellation`.
- استخدام `warehouse_selection_mode`.
- استخدام الحد العام كقيمة افتراضية للمنتجات الجديدة فقط.

### الضريبة

- إنشاء `TaxCalculatorService`.
- حساب Inclusive وExclusive.
- دعم إعفاء المنتج.
- دعم معدل المنتج.
- دعم المعدل الافتراضي.
- حفظ Tax Snapshot.
- إضافة حقول الضريبة للطلب وعناصره.

### معيار الإغلاق

Quote وCheckout والفاتورة يجب أن تعطي القيم نفسها.

---

## المرحلة السابعة: إكمال الفواتير والمرتجعات

### الفواتير

إنشاء:

```text
invoices
invoice_items
document_sequences
```

مع:

- ترقيم آمن.
- Seller Snapshot.
- Customer Snapshot.
- Tax Breakdown.
- إصدار HTML/PDF.
- ربط الفاتورة بالطلب.

### المرتجعات

إنشاء:

```text
return_requests
return_items
return_events
refund_transactions
```

وربط:

```text
allow_returns
return_window_days
```

فعليًا.

### معيار الإغلاق

لا يتم تغيير الطلب مباشرة إلى `returned` دون Return Request مكتمل، إلا بصلاحية إدارية خاصة.

---

## المرحلة الثامنة: إصلاح OTP والإشعارات

### OTP

- تطبيق TTL من الإعدادات.
- تطبيق عدد المحاولات.
- تطبيق Resend Cooldown.
- تطبيق Maximum Resends.
- إزالة طباعة الرمز.
- إنشاء SMS/Email Provider.
- منع التسجيل التلقائي إلا عند تفعيله.

### الإشعارات

- ربط بريد استقبال الطلبات.
- ربط بريد المخزون.
- ربط بريد الدعم.
- تنفيذ Email Channel.
- تنفيذ Daily Digest.
- تنظيف الأحداث القديمة.
- توحيد Outbox كمدخل لجميع الإشعارات.

### معيار الإغلاق

اختيار `email = disabled` يمنع الإرسال، واختيار `daily_digest` ينشئ ملخصًا فعليًا.

---

## المرحلة التاسعة: إعادة بناء لوحة إعدادات التشغيل

تحتوي الصفحة الجديدة على تبويبات:

```text
عام
الطلبات
المخزون
الضريبة والفواتير
المصادقة OTP
الإشعارات
تطبيق الهاتف
```

ولا تحتوي على:

```text
ألوان
خطوط
Themes
Layout
Homepage Builder
Pages
SEO Editor
Store Slug
Subdomain
```

طرق الدفع والشحن والولاء تبقى صفحات مستقلة؛ لأنها أنظمة وليست حقول إعدادات بسيطة.

---

## المرحلة العاشرة: اختبارات الربط التشغيلي

إضافة اختبارات تكامل تثبت:

1. تغيير العملة الافتراضية يؤثر على الطلب اليدوي.
2. الحد الأدنى يمنع Checkout.
3. تعطيل Guest Checkout يجبر تسجيل الدخول.
4. Prefix الطلب يظهر في الرقم.
5. سياسة الإلغاء تمنع الإلغاء بعد المهلة.
6. انتهاء مهلة الدفع يلغي الطلب المؤهل.
7. Reservation TTL يحرر المخزون.
8. Allow Out of Stock يغير سلوك Checkout.
9. Inclusive Tax يحسب بصورة صحيحة.
10. Exclusive Tax يضيف الضريبة.
11. طريقة دفع معطلة لا تظهر ولا تُقبل.
12. طريقة شحن معطلة لا تُقبل.
13. البريد التشغيلي يستقبل طلبًا جديدًا.
14. OTP يحترم Cooldown والمحاولات.
15. الحد الافتراضي للمخزون يطبق على Variant جديد.
16. تعطيل الولاء يمنع الكسب والاستبدال.
17. Return Window يمنع الطلبات القديمة.
18. رقم الفاتورة لا يتكرر تحت التزامن.
19. Outbox لا يفقد حدث الطلب.
20. Quote وCheckout يعطيان الإجمالي نفسه.

---

# سابعًا: مرحلة توحيد الـMigrations

المشروع يحتوي على عدد كبير من الـMigrations، وبعضها:

- ينشئ أنظمة SaaS.
- ينشئ Themes.
- ينشئ Domains.
- ينشئ اشتراكات.
- ينشئ جداول قديمة.
- ثم يحذفها لاحقًا.

## التوقيت الصحيح

لا يتم توحيد الـMigrations قبل إكمال:

1. الحذف.
2. إعادة تصميم الإعدادات.
3. ربط المنطق.
4. إكمال الجداول.
5. الاختبارات.

الترتيب الصحيح:

```text
الحذف
إعادة تصميم الإعدادات
ربط المنطق
إكمال الجداول
الاختبارات
ثم Baseline
```

## خطوات التوحيد

### 1. إنشاء Tag أرشيفية

```text
pre-ecommerce-core-baseline
```

### 2. إنشاء قاعدة بيانات نظيفة

تشغيل الشكل النهائي بعد جميع الإصلاحات.

### 3. استخراج الـSchema النهائي

ومراجعة:

- الجداول.
- Foreign Keys.
- Unique Constraints.
- Check Constraints.
- Indexes.
- Enums.
- Triggers.
- Extensions.

### 4. حذف جميع الـMigrations القديمة من الفرع الرئيسي

تبقى محفوظة في:

- Git History.
- الـTag الأرشيفية.

### 5. إنشاء Baseline واحدة

```text
001_initial_ecommerce_core.up.sql
001_initial_ecommerce_core.down.sql
```

وتحتوي فقط على الشكل النهائي.

### 6. فصل البيانات المرجعية

إنشاء:

```text
seed-reference-data.sql
```

ويشمل:

- Roles.
- Permissions.
- Payment Method Catalog.
- حالات النظام المرجعية.

ولا يحتوي على بيانات عميل محدد.

### 7. اختبار قاعدة فارغة

يجب أن ينجح:

```text
Create database
Run baseline
Run seeds
Start backend
Run integration tests
Build admin
```

### 8. الماجريشن المستقبلية

بعد إطلاق النسخة:

```text
002_...
003_...
004_...
```

ولا يتم حذفها أو دمجها مرة أخرى بعد وجود قواعد بيانات إنتاجية.

---

# ثامنًا: النتيجة النهائية المستهدفة

## أنظمة التجارة

- الكتالوج.
- المنتجات والمتغيرات.
- التصنيفات والعلامات.
- المخزون والمستودعات.
- السلة وCheckout.
- الطلبات.
- الدفع.
- الشحن.
- الضرائب.
- الفواتير.
- المرتجعات والاستردادات.
- العملاء.
- العروض والكوبونات.
- الولاء.
- الإشعارات.
- الدعم الفني.
- الموظفون والصلاحيات.
- التحليلات.

## إعدادات تشغيل حقيقية

كل حقل ظاهر في لوحة التحكم:

- يؤثر في النظام فعليًا.
- له مصدر حقيقة واحد.
- له اختبار تكامل يثبت تأثيره.
- أو لا يظهر أصلًا.

## لا يوجد داخل النواة

- تخصيص مظهر.
- Theme Builder.
- إدارة قوالب.
- Storefront Page Builder.
- SEO Page Editor.
- Subdomain Manager.
- اشتراكات SaaS.
- Store Capabilities مبنية على الباقات.
- JSON Settings غير مستخدمة.

---

# الحكم النهائي

الإعدادات الحالية ليست مكتملة الربط.

معظم:

```text
orderSettings
inventorySettings
taxSettings
```

هي تخزين فقط أو ربط جزئي.

القرار الصحيح هو:

1. حذف إعدادات المظهر والصفحات والتهيئة.
2. حذف `store_general_settings`.
3. إنشاء جداول تشغيل Typed.
4. الاحتفاظ بالأنظمة المستقلة للدفع والشحن والعملات والولاء.
5. ربط كل إعداد بخدمة المجال الخاصة به.
6. إكمال الضريبة والفواتير والمرتجعات وOTP والإشعارات.
7. إجراء اختبارات ربط فعلية.
8. إنشاء Baseline Migration واحدة بعد استقرار الشكل النهائي.

بعد تنفيذ ذلك تصبح النسخة:

> **نواة متجر إلكتروني حقيقية وواضحة، وكل إعداد ظاهر فيها مرتبط بمنطق فعلي، وليست مجرد شاشة وتخزين بيانات.**
