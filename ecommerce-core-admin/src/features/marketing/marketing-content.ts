export type MarketingLocale = 'ar' | 'en';
export type MarketingDirection = 'rtl' | 'ltr';

export const DEFAULT_MARKETING_LOCALE: MarketingLocale = 'ar';

export function resolveMarketingLocale(value: string): MarketingLocale {
  return value === 'en' ? 'en' : DEFAULT_MARKETING_LOCALE;
}

export const marketingContent = {
  ar: {
    direction: 'rtl',
    nav: {
      links: [
        { href: '#home-to-store', label: 'المسارات' },
        { href: '#showcase', label: 'المنتج' },
        { href: '#features', label: 'المميزات' },
        { href: '#themes', label: 'القوالب' },
        { href: '#faq', label: 'الأسئلة' },
      ],
      ariaLabel: 'أقسام صفحة النظام ستور',
      signIn: 'دخول',
      createStore: 'أنشئ متجرك',
      start: 'ابدأ',
      menuAria: 'فتح القائمة',
      mobileTitle: 'أقسام النظام ستور',
      mobileSignIn: 'تسجيل الدخول',
      themeLight: 'الوضع الفاتح',
      themeDark: 'الوضع الليلي',
      themeLightAria: 'تفعيل الوضع الفاتح',
      themeDarkAria: 'تفعيل الوضع الليلي',
      languageTooltip: 'English',
      languageAria: 'تبديل اللغة إلى الإنجليزية',
      languageButtonLabel: 'EN',
    },
    home: {
      backToTopTitle: 'العودة للأعلى',
      backToTopAria: 'العودة إلى أعلى الصفحة',
    },
    hero: {
      eyebrow: 'منصة يمنية لبناء متجرك الإلكتروني دون تعقيد',
      title: 'افتح متجرًا إلكترونيًا يعمل معك طوال اليوم',
      description:
        'النظام ستور يساعدك تنقل تجارتك إلى الإنترنت، سواء كان لديك متجر على الواقع أو تبدأ من المنزل. اعرض منتجاتك، استقبل الطلبات، خصص هوية متجرك، واربط الدومين والشحن والدفع من منصة واحدة بدل بناء كل شيء من الصفر.',
      primaryCta: 'أنشئ متجرك الآن',
      secondaryCta: 'شاهد كيف يعمل',
      checks: [
        'مناسب للمتاجر الواقعية',
        'يمكنك البدء حتى من المنزل',
        'بدون برمجة وسيرفرات',
        'طلباتك تعمل حتى خارج وقت الدوام',
      ],
      stats: [
        { value: '24/7', label: 'متجر يعمل خارج وقت الدوام' },
        { value: 'بدون تعقيد', label: 'إطلاق دون إعداد تقني مرهق' },
        { value: 'من أي بداية', label: 'متجر واقعي أو مشروع ناشئ' },
      ],
      trustSignals: [
        { value: 'Yemen', label: 'مصمم لسياق السوق المحلي' },
        { value: 'Store', label: 'يناسب المتاجر الواقعية' },
        { value: 'Home', label: 'يمكن البدء حتى من المنزل' },
        { value: 'No-Code', label: 'بدون فريق برمجة وتشغيل معقد' },
      ],
    },
    problem: {
      eyebrow: 'المشكلة التي نحلها',
      title: 'بدل متجر يغلق وأدوات متفرقة، قناة بيع إلكترونية جاهزة',
      description:
        'التاجر لا يحتاج أن يبني موقعاً وسيرفرات وربطاً تقنياً من الصفر. النظام يجمع واجهة المتجر والطلبات والهوية والتشغيل في تجربة واحدة أوضح.',
      beforeTitle: 'قبل النظام ستور',
      afterTitle: 'بعد النظام ستور',
      problemItems: [
        'المتجر الواقعي يغلق بانتهاء الدوام، بينما العملاء قد يطلبون في أي وقت.',
        'بناء متجر خاص من الصفر يحتاج برمجة وتشغيلاً تقنياً وصيانة مستمرة.',
        'البيع عبر الرسائل يشتت المنتجات والأسعار والطلبات بين محادثات وجداول كثيرة.',
        'ربط الدومين والحماية والشحن والدفع يتحول إلى عبء تقني على التاجر.',
      ],
      solutionItems: [
        'متجر إلكتروني يعرض منتجاتك ويستقبل الطلبات حتى خارج وقت الدوام.',
        'منصة جاهزة تقلل الحاجة لبناء موقع وتشغيل تقني من الصفر.',
        'لوحة واحدة تجمع المنتجات والطلبات والعملاء بدل فوضى الرسائل.',
        'هوية ودومين وتجهيزات تشغيلية تساعد التاجر يبدأ بوضوح ثم يتوسع.',
      ],
      metricCards: [
        { label: 'تشغيل مشتت', value: 'قبل', caption: 'رسائل وجداول وقرارات متفرقة' },
        { label: 'تجربة منظمة', value: 'بعد', caption: 'منتج وطلب وعميل في مسار واحد' },
      ],
      impactTitle: 'أثر التحول على تجربة التاجر',
      impactData: [
        { name: 'التوفر', before: 34, after: 92 },
        { name: 'التنظيم', before: 28, after: 86 },
        { name: 'الثقة', before: 42, after: 88 },
        { name: 'سرعة الإطلاق', before: 24, after: 82 },
      ],
      clarityData: [
        { name: 'قبل', value: 72, secondary: 24 },
        { name: 'بعد', value: 28, secondary: 84 },
      ],
    },
    homeToStore: {
      eyebrow: 'من أي بداية إلى متجر',
      title: 'متجر إلكتروني حقيقي دون بناء كل شيء من الصفر',
      description:
        'سواء بدأت من محل قائم، مشروع من المنزل، أو بيع عبر الرسائل، النظام يحول تجارتك إلى رابط واضح وطلبات منظمة وقناة بيع تعمل طوال اليوم.',
      flow: [
        { label: 'محل أو واتساب', caption: 'بداية موجودة لكن البيع موزع' },
        { label: 'كتالوج واضح', caption: 'المنتجات والأسعار في رابط واحد' },
        { label: 'طلبات منظمة', caption: 'كل طلب يدخل مسار متابعة' },
        { label: 'نطاق وهوية', caption: 'المتجر يظهر باسم علامتك' },
        { label: 'نمو يومي', caption: 'تشغيل قابل للتوسع' },
      ],
      preview: {
        caption: 'متجر واقعي + قناة إلكترونية',
        title: 'متجر عطور وهدايا',
        products: [
          { name: 'عطر شرقي', price: '12,500 ر.ي' },
          { name: 'هدية جاهزة', price: '7,200 ر.ي' },
        ],
        orderCaption: 'طلب جديد من رابط المتجر',
        orderLine: '#1041 · عطر شرقي · وصل خارج وقت الدوام',
        noServersCaption: 'بدون إعداد سيرفرات أو فريق برمجة',
        noServersTitle: 'واجهة، طلبات، وهوية في مسار جاهز للإطلاق',
        readinessTitle: 'جاهزية الإطلاق',
      },
      steps: [
        {
          step: '01',
          title: 'متجر واقعي يريد البيع أونلاين',
          description: 'افتح قناة إلكترونية تستقبل الطلبات بعد إغلاق المحل وتعرض منتجاتك بوضوح.',
        },
        {
          step: '02',
          title: 'مشروع يبدأ حتى من المنزل',
          description: 'ابدأ بدون محل فعلي، ثم ابنِ واجهة موثوقة تكبر مع نشاطك خطوة خطوة.',
        },
        {
          step: '03',
          title: 'تاجر رسائل يريد التنظيم',
          description: 'حوّل الصور والأسعار والطلبات المتفرقة إلى رابط متجر ولوحة متابعة واحدة.',
        },
      ],
      buildTitle: 'بدل أن تبني كل شيء من الصفر',
      buildCostItems: [
        {
          title: 'برمجة الموقع والسيرفرات',
          description: 'بدل البحث عن فريق تقني واستضافة وصيانة مستمرة، تبدأ من منصة جاهزة.',
        },
        {
          title: 'الدومين والحماية والتشغيل',
          description: 'بدل إدارة تفاصيل تقنية كثيرة، تحصل على مسار واضح لإطلاق متجر موثوق.',
        },
        {
          title: 'الشحن والدفع والنمو',
          description: 'بدل ربط أدوات متفرقة، تجمع احتياجات التشغيل الأساسية في مكان واحد.',
        },
      ],
      launchReadinessData: [
        { name: 'اليوم 1', value: 18 },
        { name: 'اليوم 2', value: 36 },
        { name: 'اليوم 3', value: 58 },
        { name: 'اليوم 4', value: 73 },
        { name: 'اليوم 5', value: 91 },
      ],
    },
    showcase: {
      eyebrow: 'نظرة من الداخل',
      title: 'واجهة وطلبات وهوية في مكان واحد',
      description:
        'مشاهد تفاعلية توضح كيف يتحول النشاط إلى متجر إلكتروني دائم دون أن تدير سيرفرات أو تبني موقعاً من الصفر.',
      scenes: [
        {
          key: 'dashboard',
          title: 'مركز تشغيل المتجر',
          description: 'كل طلباتك ومنتجاتك بدل أن تبقى موزعة بين المحل والمحادثات والملاحظات.',
        },
        {
          key: 'storefront',
          title: 'واجهة متجر احترافية',
          description: 'رابط واضح يفتح متجرك الإلكتروني ويجعل منتجاتك متاحة طوال الوقت.',
        },
        {
          key: 'themes',
          title: 'ثيمات قابلة للتخصيص',
          description: 'ألوان وأقسام تساعد نشاطك أن يظهر كعلامة موثوقة أمام العملاء.',
        },
        {
          key: 'domain',
          title: 'دومين آمن جاهز',
          description: 'اسم متجرك ودومينك الخاص يمنح العملاء ثقة أكبر قبل الطلب.',
        },
      ],
      commandCenter: {
        eyebrow: 'مركز متجرك',
        title: 'منتجات وطلبات في شاشة واحدة',
        chartTitle: 'نمو الطلبات خلال 30 يوم',
        secureDomain: 'دومينك آمن SSL',
        newOrder: 'طلب جديد',
        newOrderLine: '#1041 · خارج وقت الدوام',
        statCards: [
          { label: 'مبيعات اليوم', value: '48,500 ر.ي', tone: 'success' },
          { label: 'طلبات خارج الدوام', value: '12', tone: 'warning' },
          { label: 'منتجات منشورة', value: '24', tone: 'primary' },
        ],
        orders: [
          { id: '#1038', name: 'عطر شرقي', status: 'وصل من المتجر الإلكتروني', amount: '12,500 ر.ي' },
          { id: '#1037', name: 'حقيبة سفر', status: 'تم تأكيد الطلب', amount: '18,200 ر.ي' },
          { id: '#1036', name: 'هدية جاهزة', status: 'قيد التجهيز', amount: '7,000 ر.ي' },
        ],
        products: [
          { name: 'منتج من المحل', stock: '42 قطعة', color: '#6EC5D6' },
          { name: 'عرض أونلاين', stock: '18 قطعة', color: '#F2B84B' },
          { name: 'مجموعة هدايا', stock: '9 قطع', color: '#9B7AE6' },
        ],
      },
      storefront: {
        storeName: 'متجر مشروعك',
        navLinks: ['الرئيسية', 'العروض', 'السلة'],
        eyebrow: 'متجرك الواقعي صار متاحاً أونلاين',
        title: 'واجهة بيع تعمل حتى بعد إغلاق المحل',
        productNames: ['عطر', 'حقيبة', 'هدية'],
        currency: 'ر.ي',
      },
      domainFlow: {
        captions: ['ربط السجل', 'تفعيل الحماية', 'المتجر يعمل'],
        verified: 'verified',
      },
    },
    audiences: {
      eyebrow: 'لمن النظام ستور؟',
      title: 'مصمم لكل تاجر يريد قناة بيع إلكترونية حقيقية',
      description:
        'نخاطب أصحاب المتاجر الواقعية، المشاريع المنزلية، بائعي واتساب وإنستغرام، والعلامات الصغيرة التي تريد متجرها الخاص بدل الاعتماد الكامل على الرسائل والمنصات العامة.',
      items: [
        {
          title: 'أصحاب المتاجر الواقعية',
          description: 'لمن يريد قناة بيع إلكترونية تعمل بعد إغلاق المحل وتصل لعملاء أكثر.',
        },
        {
          title: 'المشاريع المنزلية والناشئة',
          description: 'لمن يريد أن يبدأ بواجهة احترافية حتى لو لم يكن لديه محل فعلي بعد.',
        },
        {
          title: 'بائعو واتساب وإنستغرام',
          description: 'لمن تعب من تكرار الردود ويريد رابط متجر مرتب بدل فوضى المحادثات.',
        },
        {
          title: 'العلامات الصغيرة',
          description: 'لمن يريد متجره الخاص وهويته ودومينه بدل الاعتماد الكامل على منصات عامة.',
        },
      ],
      fitTitle: 'خريطة الملاءمة',
      fitDescription: 'كل فئة لا تحصل على “متجر” فقط؛ تحصل على حل واضح للعائق الذي يمنع البيع المنظم.',
      gains: [
        { label: 'المتجر الواقعي', gain: 'قناة بيع لا تغلق مع نهاية الدوام', score: '92%', tone: 'primary' },
        { label: 'المشروع المنزلي', gain: 'واجهة ثقة قبل امتلاك محل فعلي', score: '84%', tone: 'secondary' },
        { label: 'بائع الرسائل', gain: 'كتالوج وطلبات بدل تكرار الردود', score: '88%', tone: 'warning' },
        { label: 'العلامة الصغيرة', gain: 'نطاق وهوية بدل الاعتماد على منصة عامة', score: '90%', tone: 'success' },
      ],
    },
    features: {
      eyebrow: 'المميزات الأساسية',
      title: 'أدوات تشغيل واضحة، لا قائمة مزايا متفرقة',
      description:
        'كل ميزة تظهر في مكانها داخل رحلة التاجر: تجهيز الكتالوج، استقبال الطلب، زيادة التحويل، ثم النمو.',
      systemNodes: [
        { label: 'كتالوج', caption: 'منتجات وفئات وصور' },
        { label: 'طلبات', caption: 'متابعة وتنفيذ' },
        { label: 'عروض', caption: 'كوبونات وتحفيز شراء' },
        { label: 'هوية', caption: 'ثيم وألوان ونطاق' },
        { label: 'نمو', caption: 'تقارير وخيارات توسع' },
      ],
      items: [
        {
          title: 'إدارة المنتجات والفئات',
          description: 'أضف منتجاتك وصورها وأسعارها في واجهة واضحة بدلاً من الرسائل المتكررة.',
        },
        {
          title: 'إدارة الطلبات',
          description: 'استقبل الطلبات وتابعها من لوحة واحدة بدل توزيعها بين المحادثات.',
        },
        {
          title: 'الثيمات والتخصيص',
          description: 'اجعل متجرك يحمل ألوان وهوية نشاطك بدل واجهة عامة بلا شخصية.',
        },
        { title: 'الدومين المخصص', description: 'شغّل متجرك على نطاقك الخاص لرفع الثقة والاحترافية.' },
        { title: 'العروض والكوبونات', description: 'فعّل الخصومات والعروض لزيادة التحويل والمبيعات.' },
        {
          title: 'الشحن والمناطق',
          description: 'حدّد مناطق التوصيل ورسومها بما يناسب مدينتك وطريقة عملك.',
        },
        {
          title: 'مركز تشغيل المتجر',
          description: 'كل منتجاتك وطلباتك وعملائك في مكان واحد سهل المتابعة.',
        },
        { title: 'جاهزية للنمو', description: 'ابدأ بما تحتاجه اليوم ثم وسّع المتجر عندما يكبر نشاطك.' },
      ],
    },
    themes: {
      eyebrow: 'القوالب والتصميم',
      title: 'هوية المتجر تتغير أمام الزائر، لا في نص الوصف فقط',
      description:
        'القسم يوضح فكرة الثيمات كتجربة حية: ألوان، عروض، ترتيب منتجات، وإحساس علامة تجارية مختلف.',
      presets: [
        {
          name: 'Classic Commerce',
          details: ['تخطيط واضح للمنتجات', 'واجهة نظيفة للثقة', 'مناسب للمتاجر العامة'],
        },
        {
          name: 'Brand Focus',
          details: ['تركيز على الهوية', 'ألوان مرنة', 'مناسب للعلامات التجارية'],
        },
        {
          name: 'Promo Ready',
          details: ['إبراز العروض', 'تسلسل شراء مباشر', 'مناسب للحملات الموسمية'],
        },
      ],
      metrics: [
        { label: 'هوية', value: 'ألوان', caption: 'المتجر يحمل شخصية العلامة', tone: 'primary' },
        { label: 'عروض', value: 'Promo', caption: 'مساحة أوضح للحملات الموسمية', tone: 'warning' },
        { label: 'ثقة', value: 'Brand', caption: 'تجربة لا تبدو كقالب عام', tone: 'secondary' },
      ],
      browserTitle: 'متجر يعكس شخصية العلامة',
      productLabel: 'منتج مميز',
      currency: 'ر.س',
    },
    domain: {
      eyebrow: 'نطاق علامتك',
      title: 'إحساس متجر حقيقي باسم علامتك',
      description:
        'رحلة النطاق مصممة بصرياً لتبدو مفهومة للتاجر: سجل، تحقق، شهادة حماية، ثم متجر يعمل باسم العلامة.',
      points: ['ربط نطاق علامتك', 'شهادة SSL', 'حضور احترافي للعلامة', 'ثقة أعلى للعملاء'],
      stepLabel: 'خطوة',
      stepSuffix: 'في جاهزية الإطلاق',
      timelineSteps: ['ربط DNS', 'شهادة SSL', 'المتجر Live'],
      body: 'يظهر المتجر باسم العلامة ويعطي العميل إشارة ثقة واضحة قبل الشراء.',
      metrics: [
        { label: 'إشارة ثقة', value: 'SSL', caption: 'حماية واضحة في رابط المتجر', tone: 'success' },
        { label: 'اسم العلامة', value: '.com', caption: 'رابط أسهل للتذكر والمشاركة', tone: 'primary' },
      ],
    },
    howItWorks: {
      eyebrow: 'خطوات العمل',
      title: 'من نشاط قائم إلى متجر إلكتروني منشور',
      description:
        'نحول الإطلاق إلى خطوات قصيرة ومفهومة، من تجهيز بيانات المتجر إلى نشر الرابط واستقبال الطلبات طوال اليوم.',
      steps: [
        {
          step: '01',
          title: 'أنشئ حسابك',
          description: 'ابدأ متجرك الإلكتروني دون دخول في تفاصيل البرمجة والاستضافة.',
        },
        {
          step: '02',
          title: 'أضف بيانات المتجر',
          description: 'اكتب اسم النشاط والبيانات التي تمنح العميل ثقة أوضح.',
        },
        {
          step: '03',
          title: 'أضف المنتجات والفئات',
          description: 'حوّل صور المنتجات والأسعار إلى كتالوج مرتب.',
        },
        {
          step: '04',
          title: 'اختر التصميم المناسب',
          description: 'فعّل هوية بصرية تناسب مشروعك وجمهورك.',
        },
        {
          step: '05',
          title: 'شارك الرابط وانطلق',
          description: 'انشر متجرك واستقبل الطلبات حتى خارج وقت دوام المتجر الواقعي.',
        },
      ],
    },
    benefits: {
      eyebrow: 'لماذا النظام ستور؟',
      title: 'القيمة تظهر عندما تصبح تجارتك متاحة ومنظمة',
      description:
        'الفائدة ليست في كثرة الأدوات فقط، بل في تحويل نشاطك إلى متجر لا يغلق، بتكلفة تشغيل أبسط من بناء متجر مخصص من الصفر.',
      metrics: [
        { label: 'توفر المتجر', value: '24/7', caption: 'الرابط يستقبل الطلبات حتى بعد الإغلاق', tone: 'success' },
        { label: 'تنظيم التشغيل', value: '1 مركز', caption: 'منتجات وطلبات وعملاء في مكان واحد', tone: 'primary' },
        { label: 'جاهزية الإطلاق', value: '5 خطوات', caption: 'مسار واضح من الحساب إلى النشر', tone: 'secondary' },
        { label: 'ثقة العميل', value: 'SSL', caption: 'نطاق آمن وواجهة أكثر احترافية', tone: 'warning' },
      ],
      quickTitle: 'قراءة سريعة للقيمة',
      quickDescription: 'كلما قلّ التشتيت زادت قدرة التاجر على البيع والمتابعة بثقة.',
      chartData: [
        { name: 'فوضى', value: 76 },
        { name: 'تنظيم', value: 42 },
        { name: 'ثقة', value: 68 },
        { name: 'نمو', value: 86 },
      ],
      items: [
        'متجر يعمل طوال اليوم',
        'واجهة احترافية تبني الثقة',
        'طلبات ومنتجات منظمة',
        'تكلفة تقنية أقل من البناء المخصص',
        'قابلية للتوسع مع نمو النشاط',
        'تقليل فوضى الرسائل والأدوات',
      ],
    },
    pricing: {
      eyebrow: 'الأسعار والخطط',
      title: 'خطط واضحة تبدأ صغيرة وتكبر مع نشاطك',
      description: 'يبقى التسعير مباشراً: ابدأ، اختبر التشغيل، ثم وسع الإمكانات عندما يكبر المتجر.',
      popularLabel: 'الأكثر شيوعاً',
      prices: ['مجاناً', '99', '199'],
      monthlySuffix: 'ر.س / شهرياً',
      startFree: 'ابدأ مجاناً',
      subscribe: 'اشترك الآن',
      capabilityHeader: 'القدرة',
      growthTitle: 'النمو مع الخطة',
      growthDescription: 'ابدأ خفيفاً، ثم وسّع الهوية والعروض والفريق عندما يكبر التشغيل.',
      plans: [
        {
          name: 'Starter',
          subtitle: 'لبداية منظمة',
          description: 'خطة مناسبة لتحويل نشاطك إلى متجر واضح بأقل تعقيد.',
          items: ['متجر واحد', 'إدارة منتجات وطلبات', 'ثيمات جاهزة'],
        },
        {
          name: 'Pro',
          subtitle: 'الأكثر شيوعًا',
          description: 'لمن يريد هوية أوضح وتشغيلاً يومياً أكثر تنظيماً.',
          items: ['كل مزايا Starter', 'دومين مخصص', 'عروض وكوبونات', 'تقارير تشغيلية'],
        },
        {
          name: 'Business',
          subtitle: 'للنمو والتوسع',
          description: 'للمتاجر المتقدمة التي تحتاج قدرات تشغيل أكبر.',
          items: ['كل مزايا Pro', 'أدوار فريق', 'خيارات توسع إضافية', 'أولوية دعم'],
        },
      ],
      capabilityRows: [
        { capability: 'كتالوج ومنتجات', starter: true, pro: true, business: true },
        { capability: 'طلبات ومتابعة تشغيل', starter: true, pro: true, business: true },
        { capability: 'نطاق علامتك', starter: false, pro: true, business: true },
        { capability: 'عروض وكوبونات', starter: false, pro: true, business: true },
        { capability: 'أدوار فريق وتوسع', starter: false, pro: false, business: true },
      ],
      growthData: [
        { name: 'Starter', value: 38 },
        { name: 'Pro', value: 68 },
        { name: 'Business', value: 92 },
      ],
    },
    faq: {
      eyebrow: 'الأسئلة الشائعة',
      title: 'إجابات قصيرة قبل قرار البدء',
      description: 'نزيل الاعتراضات الأساسية حول التقنية، التخصيص، الدومين، والنمو التدريجي.',
      metrics: [
        { label: 'التقنية', value: 'جاهز', caption: 'لا تحتاج بناء وتشغيل من الصفر', tone: 'primary' },
        { label: 'الهوية', value: 'نطاق', caption: 'المتجر يظهر باسم علامتك', tone: 'success' },
        { label: 'النمو', value: 'تدريجي', caption: 'ابدأ صغيراً ثم وسع الإمكانات', tone: 'warning' },
      ],
      items: [
        {
          question: 'هل يناسب النظام ستور متجراً واقعياً وليس مشروعاً منزلياً فقط؟',
          answer:
            'لا، يناسب المتاجر الواقعية والمشاريع المنزلية والتجار عبر الرسائل. فكرة المنزل فقط تعني أن البدء ممكن حتى بدون محل فعلي.',
        },
        {
          question: 'هل سأحتاج شخصاً تقنياً لتجهيز المتجر؟',
          answer: 'لا، الفكرة أن تبدأ من مسار جاهز وواضح بدلاً من بناء متجر وتشغيل تقني من الصفر.',
        },
        {
          question: 'هل يظهر المتجر باسم علامتي؟',
          answer: 'نعم، يمكنك ربط نطاق علامتك ليظهر المتجر بشكل أوثق وأكثر احترافية أمام العملاء.',
        },
        {
          question: 'هل أستطيع تخصيص شكل المتجر؟',
          answer: 'نعم، يمكنك تعديل الثيمات والألوان والأقسام الأساسية.',
        },
        {
          question: 'هل سيقلل فوضى الطلبات والرسائل؟',
          answer: 'نعم، يوجد مركز تشغيل يجمع المنتجات والطلبات بدلاً من توزيعها بين الرسائل والملاحظات.',
        },
        {
          question: 'هل يمكن البدء صغيرًا ثم التوسع؟',
          answer: 'بالتأكيد، المنصة مصممة لتدعم النمو التدريجي.',
        },
        {
          question: 'هل يمكن إضافة فريق عمل لاحقًا؟',
          answer: 'نعم، تتوفر إمكانيات تنظيم الفريق في الخطط المتقدمة.',
        },
      ],
    },
    finalCta: {
      title: 'اجعل تجارتك متاحة حتى بعد إغلاق المحل',
      description:
        'جهّز واجهة منتجاتك، شارك الرابط مع عملائك، ثم تابع الطلبات والتخصيص والدومين من مكان واحد دون بناء تقني مكلف من الصفر.',
      cards: [
        { label: 'كتالوج', caption: 'منتجات واضحة' },
        { label: 'طلبات', caption: 'متابعة منظمة' },
        { label: 'نطاق', caption: 'ثقة العلامة' },
        { label: 'نمو', caption: 'تشغيل قابل للتوسع' },
      ],
      primaryCta: 'أنشئ متجرك الآن',
      secondaryCta: 'شاهد كيف يعمل',
    },
    screenshots: {
      eyebrow: 'نظرة من الداخل',
      title: 'لوحة تحكم احترافية وسهلة',
      description: 'صممنا واجهة المستخدم لتكون واضحة وبديهية لتتمكن من إدارة متجرك بكل سهولة وسرعة.',
      imageLabel: 'صورة المنصة',
      items: [
        { title: 'لوحة المنتجات', caption: 'إدارة المنتجات والفئات والمخزون من شاشة واحدة.' },
        { title: 'لوحة الطلبات', caption: 'متابعة حالة الطلبات وخطوات التنفيذ.' },
        { title: 'الثيمات والتخصيص', caption: 'اختيار القالب وضبط الهوية البصرية.' },
        { title: 'إعدادات الدومين', caption: 'ربط الدومين والتحقق من الإعدادات الأساسية.' },
        { title: 'واجهة المتجر', caption: 'معاينة تجربة العميل قبل النشر.' },
      ],
    },
    footer: {
      description:
        'منصة متكاملة للتجارة الإلكترونية تساعد العلامات التجارية العربية على إطلاق وإدارة متاجرها باحترافية وسهولة تامة.',
      copyright: 'جميع الحقوق محفوظة',
      terms: 'شروط الاستخدام',
      privacy: 'سياسة الخصوصية',
      columns: [
        { title: 'المنتج', links: ['المميزات', 'القوالب', 'الأسعار', 'الأسئلة الشائعة'] },
        { title: 'روابط سريعة', links: ['ابدأ الآن', 'شاهد المتجر التجريبي', 'تواصل معنا', 'سياسة الخصوصية'] },
        { title: 'Ecommerce Core Store', links: ['منصة SaaS عربية', 'دعم النمو التجاري', 'واجهة احترافية', 'تجربة تشغيل واضحة'] },
      ],
    },
    mascot: {
      showTooltip: 'إظهار شخصية النظام',
      showAria: 'إظهار شخصية النظام',
      hideTooltip: 'إخفاء شخصية النظام',
      hideAria: 'إخفاء شخصية النظام',
      scenes: [
        { id: 'hero', label: 'البداية', message: 'أهلاً، سأرافقك داخل الرحلة بدل أن أبقى خارجها.' },
        { id: 'problem', label: 'الفوضى والحل', message: 'هنا أستمع للمشكلة، ثم أشير إلى التحول بعد النظام.' },
        { id: 'showcase', label: 'المنتج', message: 'الآن أوجّه النظر إلى المنتج وهو يعمل أمام الزائر.' },
        { id: 'for-who', label: 'لمن؟', message: 'كل بطاقة جمهور تحصل على تقديم صغير بدل المرور الصامت.' },
        { id: 'features', label: 'الأدوات', message: 'هنا تصبح الحركة أسرع قليلًا، لأن الأدوات هي قلب التشغيل.' },
        { id: 'themes', label: 'الثيمات', message: 'مع تغيّر الهوية، أدور بخفة كأنني أبدّل الواجهة معك.' },
        { id: 'domain', label: 'الدومين', message: 'إشارة ثقة صغيرة عند SSL والدومين حتى تبدو الخطوة مفهومة.' },
        { id: 'how-it-works', label: 'الخطوات', message: 'أمشي مع الخطوات، من الحساب إلى متجر منشور.' },
        { id: 'benefits', label: 'القيمة', message: 'القيمة التجارية هنا: أقل فوضى، تشغيل أوضح، ونمو أهدأ.' },
        { id: 'pricing', label: 'الخطط', message: 'هنا أهدأ: المقارنة تحتاج وضوحًا أكثر من الاستعراض.' },
        { id: 'faq', label: 'الأسئلة', message: 'آخر الاعتراضات تحتاج طمأنة، لا ضجيجًا.' },
        { id: 'final-cta', label: 'الانطلاق', message: 'نعود معًا إلى القرار: متجر واضح وجاهز للبيع.' },
      ],
    },
  },
  en: {
    direction: 'ltr',
    nav: {
      links: [
        { href: '#home-to-store', label: 'Paths' },
        { href: '#showcase', label: 'Product' },
        { href: '#features', label: 'Features' },
        { href: '#themes', label: 'Themes' },
        { href: '#faq', label: 'FAQ' },
      ],
      ariaLabel: 'Ecommerce Core Store landing sections',
      signIn: 'Sign in',
      createStore: 'Create store',
      start: 'Start',
      menuAria: 'Open menu',
      mobileTitle: 'Ecommerce Core Store sections',
      mobileSignIn: 'Sign in',
      themeLight: 'Light mode',
      themeDark: 'Dark mode',
      themeLightAria: 'Enable light mode',
      themeDarkAria: 'Enable dark mode',
      languageTooltip: 'العربية',
      languageAria: 'Switch language to Arabic',
      languageButtonLabel: 'AR',
    },
    home: {
      backToTopTitle: 'Back to top',
      backToTopAria: 'Back to top',
    },
    hero: {
      eyebrow: 'A Yemeni platform for launching your online store without the technical drag',
      title: 'Open an online store that keeps selling all day',
      description:
        'Ecommerce Core Store helps move your business online, whether you already run a physical shop or are starting from home. Show products, receive orders, customize your identity, and connect domain, shipping, and payments from one platform instead of building everything from scratch.',
      primaryCta: 'Create your store',
      secondaryCta: 'See how it works',
      checks: [
        'Built for physical stores',
        'Start even from home',
        'No coding or servers',
        'Orders keep coming after hours',
      ],
      stats: [
        { value: '24/7', label: 'A store that works after hours' },
        { value: 'Simple', label: 'Launch without heavy technical setup' },
        { value: 'Any start', label: 'Physical store or new project' },
      ],
      trustSignals: [
        { value: 'Yemen', label: 'Designed for the local market context' },
        { value: 'Store', label: 'Fits real-world stores' },
        { value: 'Home', label: 'Start even from home' },
        { value: 'No-Code', label: 'No complex dev or ops team' },
      ],
    },
    problem: {
      eyebrow: 'The problem we solve',
      title: 'Instead of a closed shop and scattered tools, get a ready online sales channel',
      description:
        'Merchants should not have to build websites, servers, and integrations from scratch. Ecommerce Core brings the storefront, orders, identity, and operations into one clearer experience.',
      beforeTitle: 'Before Ecommerce Core Store',
      afterTitle: 'After Ecommerce Core Store',
      problemItems: [
        'The physical store closes at the end of the day, while customers may order anytime.',
        'Building a custom store from scratch needs development, technical operations, and ongoing maintenance.',
        'Selling through messages scatters products, prices, and orders across chats and sheets.',
        'Domain, security, shipping, and payments become a technical burden for the merchant.',
      ],
      solutionItems: [
        'An online store that displays products and receives orders even outside business hours.',
        'A ready platform that reduces the need to build and operate a website from scratch.',
        'One dashboard for products, orders, and customers instead of message chaos.',
        'Identity, domain, and operational setup that help merchants start clearly and grow.',
      ],
      metricCards: [
        { label: 'Scattered ops', value: 'Before', caption: 'Messages, sheets, and split decisions' },
        { label: 'Organized experience', value: 'After', caption: 'Product, order, and customer in one flow' },
      ],
      impactTitle: 'Impact on the merchant experience',
      impactData: [
        { name: 'Availability', before: 34, after: 92 },
        { name: 'Organization', before: 28, after: 86 },
        { name: 'Trust', before: 42, after: 88 },
        { name: 'Launch speed', before: 24, after: 82 },
      ],
      clarityData: [
        { name: 'Before', value: 72, secondary: 24 },
        { name: 'After', value: 28, secondary: 84 },
      ],
    },
    homeToStore: {
      eyebrow: 'From any start to a store',
      title: 'A real online store without building everything from scratch',
      description:
        'Whether you start from an existing shop, a home project, or message-based selling, Ecommerce Core turns your commerce into a clear link, organized orders, and an all-day sales channel.',
      flow: [
        { label: 'Shop or WhatsApp', caption: 'A real start, but sales are scattered' },
        { label: 'Clear catalog', caption: 'Products and prices in one link' },
        { label: 'Organized orders', caption: 'Every order enters a tracking flow' },
        { label: 'Domain and identity', caption: 'The store appears under your brand' },
        { label: 'Daily growth', caption: 'Operations ready to scale' },
      ],
      preview: {
        caption: 'Physical store + online channel',
        title: 'Perfume and gifts store',
        products: [
          { name: 'Oriental perfume', price: '12,500 YER' },
          { name: 'Ready gift', price: '7,200 YER' },
        ],
        orderCaption: 'New order from store link',
        orderLine: '#1041 · Oriental perfume · arrived after hours',
        noServersCaption: 'No server setup or dev team',
        noServersTitle: 'Storefront, orders, and identity in a launch-ready path',
        readinessTitle: 'Launch readiness',
      },
      steps: [
        {
          step: '01',
          title: 'A physical store wants to sell online',
          description: 'Open an online channel that receives orders after closing and presents products clearly.',
        },
        {
          step: '02',
          title: 'A project starts from home',
          description: 'Start without a physical location, then build a trusted storefront that grows with you.',
        },
        {
          step: '03',
          title: 'A message seller wants order',
          description: 'Turn scattered product photos, prices, and requests into one store link and dashboard.',
        },
      ],
      buildTitle: 'Instead of building everything from scratch',
      buildCostItems: [
        {
          title: 'Website and server development',
          description: 'Start from a ready platform instead of hunting for a technical team, hosting, and maintenance.',
        },
        {
          title: 'Domain, security, and operations',
          description: 'Get a clear path to launch a trusted store instead of managing many technical details.',
        },
        {
          title: 'Shipping, payments, and growth',
          description: 'Bring core operating needs together instead of stitching separate tools.',
        },
      ],
      launchReadinessData: [
        { name: 'Day 1', value: 18 },
        { name: 'Day 2', value: 36 },
        { name: 'Day 3', value: 58 },
        { name: 'Day 4', value: 73 },
        { name: 'Day 5', value: 91 },
      ],
    },
    showcase: {
      eyebrow: 'Inside the product',
      title: 'Storefront, orders, and identity in one place',
      description:
        'Interactive scenes show how a business becomes an always-on online store without managing servers or building a site from scratch.',
      scenes: [
        {
          key: 'dashboard',
          title: 'Store operations center',
          description: 'All orders and products instead of keeping them split across the shop, chats, and notes.',
        },
        {
          key: 'storefront',
          title: 'Professional storefront',
          description: 'A clear link opens your online store and keeps products available all the time.',
        },
        {
          key: 'themes',
          title: 'Customizable themes',
          description: 'Colors and sections help your business look like a trusted brand.',
        },
        {
          key: 'domain',
          title: 'Secure domain, ready',
          description: 'Your store name and custom domain give customers more trust before ordering.',
        },
      ],
      commandCenter: {
        eyebrow: 'Your store center',
        title: 'Products and orders in one screen',
        chartTitle: 'Order growth over 30 days',
        secureDomain: 'Your domain is SSL-secured',
        newOrder: 'New order',
        newOrderLine: '#1041 · after hours',
        statCards: [
          { label: 'Today sales', value: '48,500 YER', tone: 'success' },
          { label: 'After-hours orders', value: '12', tone: 'warning' },
          { label: 'Published products', value: '24', tone: 'primary' },
        ],
        orders: [
          { id: '#1038', name: 'Oriental perfume', status: 'Arrived from online store', amount: '12,500 YER' },
          { id: '#1037', name: 'Travel bag', status: 'Order confirmed', amount: '18,200 YER' },
          { id: '#1036', name: 'Ready gift', status: 'Preparing', amount: '7,000 YER' },
        ],
        products: [
          { name: 'Shop product', stock: '42 items', color: '#6EC5D6' },
          { name: 'Online offer', stock: '18 items', color: '#F2B84B' },
          { name: 'Gift bundle', stock: '9 items', color: '#9B7AE6' },
        ],
      },
      storefront: {
        storeName: 'Your project store',
        navLinks: ['Home', 'Offers', 'Cart'],
        eyebrow: 'Your physical store is now online',
        title: 'A sales front that works after closing',
        productNames: ['Perfume', 'Bag', 'Gift'],
        currency: 'YER',
      },
      domainFlow: {
        captions: ['Connect DNS', 'Enable security', 'Store is live'],
        verified: 'verified',
      },
    },
    audiences: {
      eyebrow: 'Who is Ecommerce Core Store for?',
      title: 'Built for every merchant who wants a real online sales channel',
      description:
        'We serve physical stores, home projects, WhatsApp and Instagram sellers, and small brands that want their own store instead of relying only on messages and public platforms.',
      items: [
        {
          title: 'Physical store owners',
          description: 'For merchants who want an online channel that keeps selling after the shop closes.',
        },
        {
          title: 'Home and early projects',
          description: 'For anyone who wants a professional front even before owning a physical store.',
        },
        {
          title: 'WhatsApp and Instagram sellers',
          description: 'For sellers tired of repeating replies who need a tidy store link instead of chat chaos.',
        },
        {
          title: 'Small brands',
          description: 'For brands that want their own identity and domain instead of relying fully on public platforms.',
        },
      ],
      fitTitle: 'Fit map',
      fitDescription: 'Each segment gets more than a store; it gets a clear answer to the blocker behind organized selling.',
      gains: [
        { label: 'Physical store', gain: 'A sales channel that does not close at the end of the day', score: '92%', tone: 'primary' },
        { label: 'Home project', gain: 'Trust front before owning a physical location', score: '84%', tone: 'secondary' },
        { label: 'Message seller', gain: 'Catalog and orders instead of repeated replies', score: '88%', tone: 'warning' },
        { label: 'Small brand', gain: 'Domain and identity instead of platform dependency', score: '90%', tone: 'success' },
      ],
    },
    features: {
      eyebrow: 'Core features',
      title: 'Clear operating tools, not a scattered feature list',
      description:
        'Each feature appears where it belongs in the merchant journey: catalog setup, orders, conversion, then growth.',
      systemNodes: [
        { label: 'Catalog', caption: 'Products, categories, images' },
        { label: 'Orders', caption: 'Tracking and fulfillment' },
        { label: 'Offers', caption: 'Coupons and purchase prompts' },
        { label: 'Identity', caption: 'Theme, colors, domain' },
        { label: 'Growth', caption: 'Reports and expansion options' },
      ],
      items: [
        {
          title: 'Products and categories',
          description: 'Add products, photos, and prices in a clear interface instead of repeated messages.',
        },
        {
          title: 'Order management',
          description: 'Receive and track orders from one dashboard instead of spreading them across chats.',
        },
        {
          title: 'Themes and customization',
          description: 'Make your store carry your colors and identity instead of a generic interface.',
        },
        { title: 'Custom domain', description: 'Run your store on your own domain to increase trust and professionalism.' },
        { title: 'Offers and coupons', description: 'Activate discounts and offers to increase conversion and sales.' },
        {
          title: 'Shipping and regions',
          description: 'Set delivery zones and fees based on your city and workflow.',
        },
        {
          title: 'Store operations center',
          description: 'Your products, orders, and customers in one place that is easy to follow.',
        },
        { title: 'Ready to grow', description: 'Start with what you need today and expand the store as your business grows.' },
      ],
    },
    themes: {
      eyebrow: 'Themes and design',
      title: 'Store identity changes in front of the visitor, not only in text',
      description:
        'This section shows themes as a live experience: colors, offers, product ordering, and a different brand feel.',
      presets: [
        {
          name: 'Classic Commerce',
          details: ['Clear product layout', 'Clean trust-focused interface', 'Good for general stores'],
        },
        {
          name: 'Brand Focus',
          details: ['Identity-first layout', 'Flexible colors', 'Good for brands'],
        },
        {
          name: 'Promo Ready',
          details: ['Highlights offers', 'Direct purchase flow', 'Good for seasonal campaigns'],
        },
      ],
      metrics: [
        { label: 'Identity', value: 'Colors', caption: 'The store carries the brand personality', tone: 'primary' },
        { label: 'Offers', value: 'Promo', caption: 'Clearer room for seasonal campaigns', tone: 'warning' },
        { label: 'Trust', value: 'Brand', caption: 'An experience that does not feel generic', tone: 'secondary' },
      ],
      browserTitle: 'A store that reflects the brand',
      productLabel: 'Featured product',
      currency: 'SAR',
    },
    domain: {
      eyebrow: 'Your brand domain',
      title: 'A real store feel under your own brand',
      description:
        'The domain journey is designed visually so it feels clear to merchants: record, verify, secure certificate, then a store live under the brand.',
      points: ['Connect your brand domain', 'SSL certificate', 'Professional brand presence', 'Higher customer trust'],
      stepLabel: 'Step',
      stepSuffix: 'in launch readiness',
      timelineSteps: ['Connect DNS', 'SSL certificate', 'Store Live'],
      body: 'The store appears under the brand name and gives customers a clear trust signal before buying.',
      metrics: [
        { label: 'Trust signal', value: 'SSL', caption: 'Visible protection in the store link', tone: 'success' },
        { label: 'Brand name', value: '.com', caption: 'A link that is easier to remember and share', tone: 'primary' },
      ],
    },
    howItWorks: {
      eyebrow: 'How it works',
      title: 'From existing business to published online store',
      description:
        'We turn launch into short, understandable steps, from store data to publishing the link and receiving orders all day.',
      steps: [
        {
          step: '01',
          title: 'Create your account',
          description: 'Start your online store without diving into programming and hosting details.',
        },
        {
          step: '02',
          title: 'Add store details',
          description: 'Write the business name and details that help customers trust you.',
        },
        {
          step: '03',
          title: 'Add products and categories',
          description: 'Turn product photos and prices into an organized catalog.',
        },
        {
          step: '04',
          title: 'Choose the right design',
          description: 'Activate a visual identity that fits your project and audience.',
        },
        {
          step: '05',
          title: 'Share the link and launch',
          description: 'Publish your store and receive orders even outside business hours.',
        },
      ],
    },
    benefits: {
      eyebrow: 'Why Ecommerce Core Store?',
      title: 'Value appears when your business becomes available and organized',
      description:
        'The benefit is not just having many tools, but turning your business into a store that never closes, with simpler operating cost than a custom build.',
      metrics: [
        { label: 'Store availability', value: '24/7', caption: 'The link receives orders even after closing', tone: 'success' },
        { label: 'Operations order', value: '1 hub', caption: 'Products, orders, and customers in one place', tone: 'primary' },
        { label: 'Launch readiness', value: '5 steps', caption: 'A clear path from account to publishing', tone: 'secondary' },
        { label: 'Customer trust', value: 'SSL', caption: 'Secure domain and more professional interface', tone: 'warning' },
      ],
      quickTitle: 'Quick value read',
      quickDescription: 'The less scattered the work is, the more confidently a merchant can sell and follow up.',
      chartData: [
        { name: 'Chaos', value: 76 },
        { name: 'Order', value: 42 },
        { name: 'Trust', value: 68 },
        { name: 'Growth', value: 86 },
      ],
      items: [
        'A store that works all day',
        'Professional interface that builds trust',
        'Organized products and orders',
        'Lower technical cost than custom build',
        'Scales as the business grows',
        'Less chaos across messages and tools',
      ],
    },
    pricing: {
      eyebrow: 'Pricing and plans',
      title: 'Clear plans that start small and grow with your business',
      description: 'Pricing stays direct: start, test operations, then expand capabilities as the store grows.',
      popularLabel: 'Most popular',
      prices: ['Free', '99', '199'],
      monthlySuffix: 'SAR / month',
      startFree: 'Start free',
      subscribe: 'Subscribe now',
      capabilityHeader: 'Capability',
      growthTitle: 'Growth by plan',
      growthDescription: 'Start light, then expand identity, offers, and team features as operations grow.',
      plans: [
        {
          name: 'Starter',
          subtitle: 'For an organized start',
          description: 'A plan for turning your business into a clear store with minimal complexity.',
          items: ['One store', 'Products and orders management', 'Ready themes'],
        },
        {
          name: 'Pro',
          subtitle: 'Most popular',
          description: 'For merchants who want clearer identity and more organized daily operations.',
          items: ['Everything in Starter', 'Custom domain', 'Offers and coupons', 'Operational reports'],
        },
        {
          name: 'Business',
          subtitle: 'For growth and scale',
          description: 'For advanced stores that need more operating capabilities.',
          items: ['Everything in Pro', 'Team roles', 'More expansion options', 'Priority support'],
        },
      ],
      capabilityRows: [
        { capability: 'Catalog and products', starter: true, pro: true, business: true },
        { capability: 'Orders and operations tracking', starter: true, pro: true, business: true },
        { capability: 'Your brand domain', starter: false, pro: true, business: true },
        { capability: 'Offers and coupons', starter: false, pro: true, business: true },
        { capability: 'Team roles and scale', starter: false, pro: false, business: true },
      ],
      growthData: [
        { name: 'Starter', value: 38 },
        { name: 'Pro', value: 68 },
        { name: 'Business', value: 92 },
      ],
    },
    faq: {
      eyebrow: 'FAQ',
      title: 'Short answers before you start',
      description: 'We remove the main objections around tech, customization, domain, and gradual growth.',
      metrics: [
        { label: 'Tech', value: 'Ready', caption: 'No need to build and operate from scratch', tone: 'primary' },
        { label: 'Identity', value: 'Domain', caption: 'The store appears under your brand', tone: 'success' },
        { label: 'Growth', value: 'Gradual', caption: 'Start small, then expand capabilities', tone: 'warning' },
      ],
      items: [
        {
          question: 'Does Ecommerce Core Store fit physical stores, not only home projects?',
          answer:
            'Yes. It fits physical stores, home projects, and message-based merchants. Starting from home only means you can begin even without a physical location.',
        },
        {
          question: 'Will I need a technical person to set up the store?',
          answer: 'No. The idea is to start from a ready, clear path instead of building and operating a store from scratch.',
        },
        {
          question: 'Will the store appear under my brand name?',
          answer: 'Yes. You can connect your brand domain so the store feels more trusted and professional to customers.',
        },
        {
          question: 'Can I customize the store look?',
          answer: 'Yes. You can edit themes, colors, and core sections.',
        },
        {
          question: 'Will it reduce order and message chaos?',
          answer: 'Yes. The operations center gathers products and orders instead of scattering them across messages and notes.',
        },
        {
          question: 'Can I start small and expand later?',
          answer: 'Absolutely. The platform is designed to support gradual growth.',
        },
        {
          question: 'Can I add team members later?',
          answer: 'Yes. Team organization capabilities are available in advanced plans.',
        },
      ],
    },
    finalCta: {
      title: 'Make your business available even after the shop closes',
      description:
        'Set up your product front, share the link with customers, then manage orders, customization, and domain from one place without expensive custom development.',
      cards: [
        { label: 'Catalog', caption: 'Clear products' },
        { label: 'Orders', caption: 'Organized follow-up' },
        { label: 'Domain', caption: 'Brand trust' },
        { label: 'Growth', caption: 'Scalable operations' },
      ],
      primaryCta: 'Create your store',
      secondaryCta: 'See how it works',
    },
    screenshots: {
      eyebrow: 'Inside the product',
      title: 'A professional, easy dashboard',
      description: 'The interface is designed to be clear and intuitive so you can manage your store quickly and comfortably.',
      imageLabel: 'Platform image',
      items: [
        { title: 'Products dashboard', caption: 'Manage products, categories, and inventory from one screen.' },
        { title: 'Orders dashboard', caption: 'Track order status and fulfillment steps.' },
        { title: 'Themes and customization', caption: 'Choose the template and adjust the visual identity.' },
        { title: 'Domain settings', caption: 'Connect the domain and verify the basic setup.' },
        { title: 'Storefront', caption: 'Preview the customer experience before publishing.' },
      ],
    },
    footer: {
      description:
        'An integrated e-commerce platform that helps Arab brands launch and manage stores professionally and with ease.',
      copyright: 'All rights reserved',
      terms: 'Terms of use',
      privacy: 'Privacy policy',
      columns: [
        { title: 'Product', links: ['Features', 'Themes', 'Pricing', 'FAQ'] },
        { title: 'Quick links', links: ['Start now', 'View demo store', 'Contact us', 'Privacy policy'] },
        { title: 'Ecommerce Core Store', links: ['Arabic SaaS platform', 'Commerce growth support', 'Professional storefront', 'Clear operating experience'] },
      ],
    },
    mascot: {
      showTooltip: 'Show Ecommerce Core guide',
      showAria: 'Show Ecommerce Core guide',
      hideTooltip: 'Hide Ecommerce Core guide',
      hideAria: 'Hide Ecommerce Core guide',
      scenes: [
        { id: 'hero', label: 'Start', message: 'Welcome. I will guide you through the journey instead of sitting outside it.' },
        { id: 'problem', label: 'Chaos and solution', message: 'Here I listen to the problem, then point to the shift after Ecommerce Core.' },
        { id: 'showcase', label: 'Product', message: 'Now I guide attention to the product working in front of the visitor.' },
        { id: 'for-who', label: 'For whom?', message: 'Each audience card gets a small introduction instead of silent scrolling.' },
        { id: 'features', label: 'Tools', message: 'The pace gets faster here because tools are the heart of daily operations.' },
        { id: 'themes', label: 'Themes', message: 'As the identity changes, I spin lightly as if switching the interface with you.' },
        { id: 'domain', label: 'Domain', message: 'A small trust signal around SSL and domain makes the step easier to understand.' },
        { id: 'how-it-works', label: 'Steps', message: 'I walk with the steps, from account to published store.' },
        { id: 'benefits', label: 'Value', message: 'The business value here: less chaos, clearer operations, calmer growth.' },
        { id: 'pricing', label: 'Plans', message: 'Here I slow down: comparison needs clarity more than showmanship.' },
        { id: 'faq', label: 'FAQ', message: 'The final objections need reassurance, not noise.' },
        { id: 'final-cta', label: 'Launch', message: 'We return to the decision: a clear store ready to sell.' },
      ],
    },
  },
} as const;

export type MarketingContent = (typeof marketingContent)[MarketingLocale];
