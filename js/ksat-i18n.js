/* =====================================================================
   ksat-i18n.js — ARABIC, AND THE SWITCH THAT WAS MISSING
   Owner: 01 Front End

   WHAT WAS ACTUALLY BROKEN — this is worth reading before changing it.

   The page looks bilingual. It carries 209 `data-i18n` attributes, a
   `tr()` helper, a `T()` helper, an `applyLang()` function and CSS for a
   `.lang` toggle. Almost none of it worked:

     1 · `const AR = {}` — the dictionary was EMPTY. Grep index.html for
         that declaration and the comment sitting on it still says
         "English-only build: the bilingual layer was removed on request."
         (By name, not by line: index.html has moved several hundred lines
         since this was written.)
     2 · NOTHING READ THE 209 ATTRIBUTES. There is no querySelectorAll
         over `[data-i18n]` anywhere in the page. They were inert markers.
         Only JS-rendered strings that call T(key, en) were ever
         translatable, and with an empty AR even those returned English.
     3 · `applyLang()` hard-coded `lang="en"` and `dir="ltr"`, so even
         setting LANG to "ar" changed nothing.
     4 · The `.lang` toggle had CSS but no markup — it was removed with
         the dictionary.

   So this file supplies all four: the dictionary, the walker, a working
   switch, and the control.

   WHY IT CHANGES NOTHING IN index.html
   `AR` is a top-level `const` in a CLASSIC script, and so is this file.
   Classic scripts share one global lexical environment, so we can reach
   the binding by name. `const` forbids REASSIGNMENT, not MUTATION — the
   object is empty, not frozen, so Object.assign fills it in place.
   `LANG` is a `let`, so it can be assigned directly. `applyLang` is a
   function DECLARATION, which means it is a property of the global
   object and can be replaced there.

   That is the whole reason this works without touching her page.

   TRANSLATION NOTES
   Modern Standard Arabic, register chosen for a scientific institution
   rather than marketing. Technical terms follow the usage of Arabic
   scientific publishing: مُقاس for measured, مُنمذَج for modelled,
   مؤشر الغطاء النباتي for vegetation index. Latin identifiers that name
   a real object — KuwaitSat-1, CubeSat, UHF, S-band, GSD — are kept in
   Latin, as Arabic technical writing does, rather than transliterated.
   Numerals stay Western Arabic (0-9), which is what Kuwaiti publications
   and instruments use.
   ===================================================================== */

(function () {
  'use strict';

  var KS = window.KSAT = window.KSAT || {};
  if (KS.i18n) return;

  /* =================================================================
     1 · THE DICTIONARY
     ================================================================= */
  var ARABIC = {
    /* --- launch sequence and gate --- */
    'vid.cap':   'مقطع أرشيفي · 0:00 – 0:08 · مضمَّن من يوتيوب',
    'vid.fall':  'مقطع الإطلاق مضمَّن من يوتيوب، وهذا العارض يحجب الوسائط الخارجية. يستمر التسلسل بدونه — والمقطع متاح عبر رابط المصدر.',
    'vid.open':  'فتح المقطع على يوتيوب',
    'gate.h':    'من الفضاء إلى كويت أكثر اخضراراً',
    'gate.p':    'هذه المقدمة مصحوبة بالصوت: عدّ تنازلي للإطلاق وتصميم صوتي أصلي مُركَّب بالكامل. لن يشغّله متصفحك إلا إذا طلبت ذلك هنا.',
    'gate.on':   'ابدأ مع الصوت',
    'gate.off':  'ابدأ بلا صوت',
    'gate.n':    'يمكنك تشغيل الصوت أو إيقافه في أي لحظة أثناء التسلسل.',
    'intro.plate':'كويت سات-١ · تسلسل الإطلاق · إعادة',
    'intro.s0':  'العدّ النهائي',
    'intro.title':'من الفضاء إلى كويت أكثر اخضراراً',
    'intro.crew':'الفريق وراء المهمة',
    'intro.enter':'الدخول إلى المنصة',
    'intro.sound':'تفعيل صوت المهمة',
    'intro.skip':'تخطّي المقدمة',
    'nav.demo':  'جولة إرشادية',

    /* --- hero --- */
    'hero.eyebrow':'رصد الأرض · الذكاء البيئي',
    'hero.h1a':  'من الفضاء إلى',
    'hero.h1b':  'كويت أكثر اخضراراً',
    'hero.lede': 'ينظر كويت سات-١ إلى الأسفل. هذه المنصة هي الطبقة التي تحوّل ما يراه القمر الصناعي إلى ما يمكن لمخطِّط أن يتصرف بناءً عليه — مسار تشغيلي يمتد من الصور، إلى التحليل البيئي، إلى توصية للتشجير.',
    'hero.cta1': 'محاكاة كويت أكثر اخضراراً',
    'hero.cta2': 'ابدأ الجولة الإرشادية',

    /* --- mission facts --- */
    'fact.k1':   'تاريخ الإطلاق',
    'fact.k2':   'المنصة',
    'fact.k3':   'دقة التصوير الأرضية',
    'fact.k4':   'عرض المسح',
    'fact.note': 'مواصفات موثّقة من ورقة المهمة المنشورة لفريق مشروع كويت سات-١ ومن إصدارات جامعة الكويت. المصادر مدرجة في أسفل هذه الصفحة.',

    /* --- the legend: the provenance key --- */
    'leg.eyebrow':'كيف تُقرأ هذه المنصة',
    'leg.h':     'كل لوحة تُعلن عن طبيعتها',
    'leg.lede':  'على منصة تجمع بين القياس والنمذجة واجب واحد: ألّا تدع القارئ يخلط بينهما أبداً. كل رسم بياني وخريطة وصورة على هذا الموقع يحمل إحدى هذه العلامات الأربع.',
    'leg.t1':    'مقيس',
    'leg.t5':    'بيانات عامة',
    'leg.t4':    'مجموعة مرجعية',
    'leg.t2':    'مُنمذَج',
    'leg.t3':    'مخرجات النموذج',
    'leg.p1':    'واقعة أو صورة منشورة من كويت سات-١ وفريق مشروعه. المصدر مرتبط دائماً.',
    'leg.p5':    'إحصاءات رسمية مفتوحة. يُعرض الرقم وسنته وجهة نشره.',
    'leg.p4':    'مُنمذَجة على أنماط بيئية كويتية منشورة، وتُستخدم بالطريقة نفسها في كل لوحة.',
    'leg.p2':    'ناتجة عن النموذج البيئي للمنصة. متسقة فيزيائياً، مُشتقّة لا مُقاسة.',
    'leg.p3':    'تفسير من المحلّل القائم على القواعد في هذه الصفحة. دعم للقرار، وليس قراراً.',
    'leg.unv':   'حين يتعذّر التحقق من تفصيلة عبر مصدر موثوق، تقول المنصة ذلك بدلاً من التفصيلة: «معلومة غير مُتحقَّق منها بشكل مستقل».',
    'leg.warn':  'لا شيء على هذا الموقع يمثّل مقترح تخطيط رسمياً أو توصية حكومية، ولا تحمل أي لوحة بيانات قياس حيّة من القمر الصناعي. هذه منصة ذكاء بيئي مبنية على سجل مهمة كويت سات-١.',

    /* --- the spacecraft --- */
    'mis.eyebrow':'المركبة الفضائية',
    'mis.h':     'كويت سات-١ في السجل',
    'mis.lede':  'أول قمر صناعي وطني للكويت هو قمر مكعّب من فئة 2وحدة بناه فريق من جامعة الكويت. كل ما في هذا الجدول منشور من المشروع أو شركائه — وهذه المنصة مبنية فوقه، لا فوق ادعاءات لم تقدّمها المركبة.',
    'mis.spec':  'سجل المهمة',
    'mis.specn':  'اثنتا عشرة مدخلة منشورة، ولكل منها مصدرها',
    'mis.note':  'الهدف الأساسي المعلن للقمر الصناعي كان بناء القدرات واختبار ما إذا كانت الكاميرا تدعم تحديد الاتجاه — لا الرصد البيئي التشغيلي. وتقترح هذه المنصة الطبقة التحليلية التي يمكن لمهمة كهذه أن تغذّيها.',
    'mis.chain': 'سلسلة المفهوم',
    'mis.gs':    'القطاع الأرضي',
    'mis.gsp':   'دخلت المحطة الأرضية في كلية العلوم بجامعة الكويت الخدمة في أكتوبر 2022: هوائي التردد فوق العالي للقياس عن بُعد والتتبّع والتحكم، وهوائي نطاق إس لتنزيل الصور، وكلاهما على وحدات تدوير.',
    'mis.live':  'الحالة',
    'desc.a':    'تنزيل البيانات',
    'desc.b':    'المحطة الأرضية · جامعة الكويت',
    'desc.c':    'من بنَوه',

    /* --- the builders --- */
    'blt.eyebrow':'من القمر الصناعي، عودةً إلى الناس',
    'blt.badge2':'⚠ صورة مقدَّمة',
    'blt.h':     'الفريق وراء كويت سات-١',
    'blt.lede':  'كل إطار في هذه المنصة يبدأ بمركبة فضائية صمّمها ودمجها واختبرها كويتيون، ويشغّلونها اليوم من حرم جامعي في مدينة الكويت. بُني أول قمر صناعي وطني للكويت على يد طلبة وكوادر جامعة الكويت بقيادة مديرة المشروع الدكتورة هالة الجسار، بدعم من مؤسسة الكويت للتقدم العلمي وهيئة الاتصالات وتقنية المعلومات وشركاء آخرين.',
    'blt.who':   'من هم',
    'blt.note':  'يذكر الموقع الرسمي للمشروع قيادته وفريق التحكم وأعضاءه بالاسم. أما الأعداد التي أوردتها الصحافة الكويتية حول الإطلاق — دفعة اختيرت من عدد أكبر بكثير من المتقدمين، وتعمل منذ 2019 — فتُنسب إلى تلك التقارير ولا تُعاد هنا بوصفها نتيجة توصّلنا إليها.',
    'blt.tl':    'الخط الزمني للمشروع',

    /* --- imagery --- */
    'img.eyebrow':'مُلتقَط من الفضاء',
    'img.h':     'مُلتقَط من الفضاء',
    'img.lede':  'في 5 أبريل 2023 أعاد كويت سات-١ أولى سلاسل صوره للكويت — خمسة إطارات متتالية، عرض كل منها نحو 80 كم، جمعها فريق المشروع في فسيفساء للنصف الشرقي من البلاد.',
    'img.disc':  'الصور الفوتوغرافية نفسها ملك لمشروع كويت سات-١ وجامعة الكويت، وهي غير منسوخة داخل هذه المنصة. كل إطار أدناه يسجّل عملية الالتقاط الحقيقية — البصمة الأرضية والتاريخ والدقة ونسبة الحقوق — ويرتبط بجهة النشر حتى يمكن الاطلاع على الأصل في مصدره.',
    'img.mos':   'بصمة الفسيفساء · 5 أبريل 2023',
    'img.mosp':  'مواضع سقوط الإطارات الخمسة، مرسومة وفق عرض المسح المنشور البالغ 80 كم فوق مخطط مبسّط لحدود البلاد. البصمة حقيقية، أما المخطط فرسم تخطيطي لا منتج مساحي.',

    /* --- explorer --- */
    'exp.eyebrow':'مستكشف الصور',
    'exp.h':     'مستكشف صور القمر الصناعي',
    'exp.lede':  'عارض عملي لرصد الأرض: حرّك وقرّب وبدّل الطبقات التحليلية وتنقّل عبر الحقب الزمنية. المشهد الأساسي تولّده هذه الصفحة على شبكة أخذ عيّنات مقدارها 39 م — وهي دقة كويت سات-١ الأرضية — فيسلك الواجهة سلوك الأداة الحقيقية دون أن يُقدَّم إطار مُركَّب على أنه حقيقي.',
    'exp.scene': 'المشهد',
    'exp.epoch': 'الحقبة (مقارنة تاريخية)',
    'exp.insp':  'المفتّش',
    'exp.hist':  'المدرّج التكراري · الطبقة المحددة',

    /* --- dashboard --- */
    'dash.eyebrow':'الذكاء البيئي',
    'dash.h':    'لوحة الذكاء البيئي',
    'dash.lede': 'الصورة الوطنية في لمحة، للمنطقة والفترة المحددتين. الأرقام مصدرها مجموعة البيانات المرجعية للمنصة، المُنمذَجة على أنماط مناخية واستخدامات أرض كويتية منشورة.',
    'dash.area': 'المنطقة',
    'dash.period':'الفترة',
    'dash.refresh':'تحديث',
    'dash.veg':  'اتجاه مؤشر الغطاء النباتي',
    'dash.stress':'الإجهاد البيئي حسب المحافظة',
    'dash.heat': 'حرارة السطح الشهرية · المحافظة',
    'dash.cool': 'أبرد',
    'dash.hot':  'أحرّ',
    'dash.gp':   'إمكانية التشجير',
    'dash.note': 'مجموعة بيانات مرجعية. تُستمد الأرقام التشغيلية من منتجات أقمار صناعية معايَرة ومحطات أرضية ومسح ميداني حال توصيل تلك المصادر.',

    /* --- greening map --- */
    'map.eyebrow':'إمكانية التشجير',
    'map.h':     'خريطة إمكانية التشجير',
    'map.lede':  'محافظات الكويت الست، مُقيَّمة بنموذج التشجير الخاص بـ كويت سات-١. اختر منطقة لترى ما نظر إليه النموذج ولماذا منحها هذه الدرجة. الدرجة العالية دعوة للفحص — لا أمر بالزراعة.',
    'map.low':   'إمكانية أدنى',
    'map.high':  'إمكانية أعلى',
    'map.rec':   'توصية تشجير ذكية',
    'map.recp':  'ما يقوله النظام عن المنطقة المحددة — مكتوباً بالطريقة التي ينبغي أن تكتب بها أداة فرز: أدلّتها وخياراتها ودرجة عدم يقينها وخطوة المتابعة، كلها على البطاقة نفسها.',
    'map.tbl':   'كل المناطق',

    /* --- the wider system --- */
    'sys.eyebrow':'النظام الأوسع',
    'sys.h':     'نظام تخطيط بيئي مدعوم بالذكاء الاصطناعي',
    'sys.lede':  'السؤال ليس «أين نزرع الأشجار»، بل كيف يمكن للكويت أن توظّف تقنية الأقمار الصناعية والبيانات البيئية والذكاء الاصطناعي لجعل مدنها أبرد وأكثر اخضراراً وأقدر على مواجهة الحرارة الشديدة. التشجير أداة واحدة في هذا النظام لا النظام كله.',
    'sys.cycle': 'توصية ← تخطيط ← رصد',
    'sys.cyclep':'التوصية المنفردة تخمين لا يتعلّم. القيمة في الحلقة: كل تدخّل يصبح خط الأساس الذي تُقاس عليه الدورة التالية.',
    'sys.cyclen':'لا تكتفي المنصة بقول أين نزرع، بل تحوّل البيانات البيئية إلى دورة متصلة من التحليل والتخطيط والعرض والرصد — مع إنسان يقرّر عند كل بوابة.',
    'sys.inp':   'ما ينظر إليه النموذج فعلياً',
    'sys.inpp':  'كل مُدخَل موسوم بنوع بياناته، وكل رقم يسمّي مصدره. ولا تعرض أي لوحة تغذية لا تملكها هذه المنصة.',
    'sys.ctx':   'السياق الوطني',

    /* --- scenario simulation --- */
    'sim.eyebrow':'محاكاة السيناريو',
    'sim.h':     'كيف يمكن أن تبدو الكويت؟',
    'sim.lede':  'اختر منطقة، شغّل محرّك التشجير، ثم اسحب المقبض. النصف الأيمن هو السطح المُنمذَج الحالي، والنصف الأيسر هو السيناريو الذي يقترحه المحرّك. كلاهما رسم — والمقصود شكل التغيّر لا البكسلات.',
    'sim.area':  'المنطقة المستهدفة',
    'sim.amb':   'طموح التدخّل',
    'sim.run':   'حاكِ كويت أكثر اخضراراً',
    'sim.before':'قبل · الحالة المُنمذَجة الراهنة',
    'sim.after': 'بعد · سيناريو التشجير بالذكاء الاصطناعي',
    'sim.warn':  'سيناريو مُنمذَج — لا مقترح تخطيط رسمي. الأنواع النباتية والمواقع والاحتياج المائي والكلفة، كلها تتطلب دراسة ميدانية قبل أن يصبح أي من هذا خطة.',
    'sim.res':   'نتيجة السيناريو',

    /* --- impact calculator --- */
    'calc.eyebrow':'حاسبة الأثر',
    'calc.h':    'ما الذي يمكن أن يتغيّر؟',
    'calc.lede': 'حرّك المُدخَلات وراقب استجابة المؤشرات المُنمذَجة. كل رقم هنا حساب على افتراضات يمكنك رؤيتها — افتح لوحة الافتراضات لقراءتها.',
    'calc.in':   'المُدخَلات',
    'calc.area': 'المساحة',
    'calc.p1':   'ممر تجريبي',
    'calc.p2':   'برنامج على مستوى منطقة',
    'calc.p3':   'إعادة ضبط',
    'calc.out':  'المؤشرات المُنمذَجة',
    'calc.assum':'الافتراضات المستخدمة في هذا التقدير',
    'calc.warn': 'تقدير مُنمذَج. يعتمد الأثر البيئي المتحقق على الأنواع والري والتربة ومعدل البقاء والصيانة، ويجب إثباته بالقياس الميداني ونماذج مُتحقَّق منها — لا بهذه الحاسبة.',

    /* --- data visualisation --- */
    'viz.eyebrow':'تصوير البيانات',
    'viz.h':     'قراءة السجل',
    'viz.lede':  'رشّح مجموعة البيانات المرجعية حسب المنطقة والفترة والمقياس. كل عرض مرسوم من الأرقام نفسها، فتتفق الرسوم والجدول دائماً.',
    'viz.area':  'المناطق',
    'viz.metric':'المقياس',
    'viz.range': 'المدى الزمني',
    'viz.table': 'إظهار الجدول',

    /* --- change detection --- */
    'cmp.eyebrow':'كشف التغيّر',
    'cmp.h':     'قارن من الفضاء',
    'cmp.lede':  'ضع حقبتين جنباً إلى جنب ثم امسح بينهما. قراءة كشف التغيّر ناتجة عن الفرق بين المشهدين المرسومين — الطريقة حقيقية، والمشاهد مُحاكاة.',
    'cmp.a':     'الصورة أ',
    'cmp.b':     'الصورة ب',
    'cmp.mode':  'العرض',
    'cmp.run':   'اكشف التغيّر',
    'cmp.res':   'قراءة التغيّر',

    /* --- 3D --- */
    'd3.eyebrow':'ثلاثة أبعاد',
    'd3.h':      'الكويت من الأعلى',
    'd3.lede':   'اسحب للتدوير، ومرّر أو اقرص للتقريب. تُبثق كل محافظة وفق المقياس المحدد، فالتضاريس التي تنظر إليها هي البيانات ذاتها. هندسة وطنية مبسّطة — تصوير لا منتج مساحي.',
    'd3.ctl':    'أدوات العرض',
    'd3.sel':    'المنطقة المحددة',

    /* --- orbit --- */
    'orb.eyebrow':'محاكاة المدار',
    'orb.h':     'أين كويت سات؟',
    'orb.lede':  'مُحرِّك مدار دائري مبسّط يعمل داخل متصفحك، مُهيَّأ بالمعاملات الاسمية للمدار المتزامن مع الشمس لعملية نشر ترانسبورتر-٦. هو نموذج تعليمي: لا يقرأ عناصر عناصر المدار، وليس متصلاً بمحطة أرضية، والأرقام أدناه تُحسب هنا ولا تُستقبل من الفضاء.',
    'orb.pause': 'إيقاف مؤقت',
    'orb.reset': 'إعادة ضبط',
    'orb.speed': 'تسريع الزمن ·',
    'orb.pass':  'نافذة الرصد',
    'orb.tel':   'قراءة القياس عن بُعد',
    'orb.warn':  'قيم مُحاكاة. هذه مخرجات نموذج جسمين دائري بميل ثابت، لا قياسات. التنبؤ الحقيقي بالمرور يتطلب عناصر مدارية محدَّثة ومُحرِّك انتشار صحيح.',
    'orb.log':   'سجل المرور',

    /* --- analyst --- */
    'an.eyebrow':'المحلّل البيئي',
    'an.h':      'محلّل كويت سات الذكي',
    'an.lede':   'اطرح سؤالاً عن مجموعة البيانات. يجيب المحلّل بهيكل ثابت — ما نظر إليه، وما وجده، ودرجة ثقته، وما يقترحه تالياً، ونوع البيانات التي يستند إليها الجواب. ويعمل بالكامل داخل هذه الصفحة على مجموعة البيانات المرجعية: لا نموذج خارجي ولا مفتاح واجهة برمجية ولا أي اتصال بالشبكة.',
    'an.sess':   'جلسة المحلّل',
    'an.clear':  'مسح',
    'an.send':   'اسأل',
    'an.guard':  'الضابط مُفعَّل: يرفض المحلّل الأسئلة التي لا يملك بيانات عنها، ويوسم نوع بيانات كل إجابة.',

    /* --- the agent --- */
    'ag.eyebrow':'الأتمتة',
    'ag.h':      'وكيل كويت سات البيئي',
    'ag.lede':   'المحلّل يجيب عن سؤال واحد. أما الوكيل فيسلك المسار كاملاً: يجمع، ويتحقق، ويحلّل، ويقرّر، ويوصي، ويكتب التقرير — متوقفاً عند نقطتَي قرار حقيقيتين يعتمد فيهما المسار على البيانات فعلاً.',
    'ag.area':   'المنطقة المستهدفة',
    'ag.thresh': 'عتبة الإجهاد ·',
    'ag.gp':     'عتبة إمكانية التشجير ·',
    'ag.run':    'تشغيل الوكيل',
    'ag.stop':   'إيقاف',
    'ag.pipe':   'المسار',
    'ag.out':    'مخرجات الوكيل',
    'ag.report': 'توليد التقرير',
    'ag.rep2':   'تقرير دعم قرار',
    'ag.copy':   'نسخ النص',

    /* --- story, national context --- */
    'st.eyebrow':'قصة الكويت الخضراء',
    'st.h':      'كويت أكثر اخضراراً تبدأ من الأعلى',
    'v35.eyebrow':'السياق الوطني',
    'v35.h':     'متوائمة مع طموحات الاستدامة في الكويت',
    'v35.lede':  'هذه منصة مستقلة. لا تحمل أي اعتماد أو تفويض أو انتساب. ما تملكه هو خط رؤية واضح نحو أنواع الأهداف الوطنية التي يمكن للذكاء البيئي المستمد من الأقمار الصناعية أن يخدمها.',
    'v35.to':    'تلتقي عند',
    'v35.goal':  'كويت أذكى وأكثر اخضراراً',
    'v35.note':  'لا يُدّعى أي اعتماد رسمي ولا يُفهم ضمناً. ويُشار إلى برنامج التنمية الوطني للكويت هنا بوصفه سياقاً عاماً فحسب.',

    /* --- guardrails --- */
    'gr.eyebrow':'الضوابط والأمن',
    'gr.h':      'ما لن يفعله هذا النظام',
    'gr.lede':   'الوكيل البيئي الذي قد يخطئ أمام الجمهور يحتاج حدوداً معلنة. وهذه الحدود مُنفَّذة في شيفرة هذه الصفحة، لا مكتوبة فقط.',
    'gr.rules':  'ضوابط الوكيل',
    'gr.aud':    'تدقيق أمني بالذكاء الاصطناعي',
    'gr.self':   'التقييم الذاتي',
    'gr.ba':     'قبل / بعد · أمثلة على التحصين',

    /* --- team --- */

    /* --- sources --- */
    'src.eyebrow':'التحقق',
    'src.h':     'المصادر ومنشأ البيانات',
    'src.lede':  'هذا الجدول هو سجل التدقيق. إن ظهر أي قول عن كويت سات-١ في أي موضع من هذه الصفحة، فهو مدرج هنا مع مصدره. وكل ما ليس في هذا الجدول فهو مُحاكى أو مُنمذَج أو تصوّري، وموسوم بذلك حيث يظهر.',
    'src.prov':  'سجل منشأ البيانات',
    'src.provp': 'كل مجموعة بيانات وطبقة تستخدمها المنصة، والفئة التي تنتمي إليها. وإن لم تكن الطبقة في هذا السجل فهي غير مستخدمة.',
    'src.ext':   'المصادر الأولية والصحفية',
    'src.not':   'ما لا تدّعيه هذه المنصة',

    /* --- finale and footer --- */
    'fin.lab':   'الفكرة كلها في جملة واحدة',
    'fin.q':     '«ننظر إلى الكويت من الفضاء — لنفهمها ونخطّط لها ونرصدها على الأرض بشكل أفضل.»',
    'fin.note':  'هذه منصة لدعم القرار. ليست نظام تخطيط حكومياً رسمياً، ولا تحمل أي اعتماد، ولا ينبغي التصرف بناءً على أي شيء فيها دون مراجعة الجهات المختصة.',
    'fin.tour':  'تشغيل الجولة الإرشادية',
    'fin.top':   'العودة إلى الأعلى',
    'ft.tag':    'من الفضاء إلى كويت أكثر اخضراراً — دعم قرار بيئي مستمد من الأقمار الصناعية.',
    'ft.nav':    'الأقسام',
    'ft.src':    'المصادر',
    'ft.leg':    'الحالة',
    'ft.l1':     'غير منتسبة إلى جامعة الكويت أو مؤسسة الكويت للتقدم العلمي أو مشروع كويت سات-١.',
    'ft.l2':     'لا قياس حيّ عن بُعد. ولا صفة تخطيط رسمية.',
    'ft.l3':     'تبقى صور الأقمار الصناعية ملكاً لناشريها.',
    'ft.l4':     'بيانات العرض تُولَّد داخل متصفحك. وتسجيل الدخول يحفظ المهمات وتشغيلات الوكيل في قاعدة بيانات المشروع.',

    /* -----------------------------------------------------------------
       THE STRINGS THAT ARE RENDERED, NOT MARKED UP

       All 205 data-i18n attributes in index.html were already covered
       above. These are not attributes: they are the strings the page
       builds at runtime through T(key, english), and T() falls back to
       its English argument whenever AR has no entry. That fallback is
       why the gap was invisible - nothing ever looked broken, the
       Arabic page simply had English furniture in it.

       The worst of them was the guided tour. 'nav.demo' IS translated,
       so an Arabic visitor pressed a button reading
       'جولة إرشادية' and got an English HUD.

       WHAT IS DELIBERATELY NOT HERE: the a.*, ag.*, rp.*, sim.* and
       bp.* keys - roughly 220 more. Those are not furniture. They are
       sentence FRAGMENTS that index.html concatenates with live numbers
       between them ('a.a2' is 'Score ', 'a.a2b' is ' is driven mainly
       by the gap between modelled stress ('). Arabic is verb-initial
       and right-to-left, so a fragment order that reads correctly in
       English produces word salad when the same pieces are joined in
       Arabic. Translating them needs the call sites restructured to
       whole sentences with placeholders, which is a piece of work in
       its own right, not a dictionary entry. Leaving them in English is
       the honest failure mode; half-translating them is not.
       ----------------------------------------------------------------- */

    /* --- guided tour HUD --- */
    'dm.step':   'الخطوة',
    'dm.judge':  'جولة التحكيم',
    'dm.prev':   'رجوع',
    'dm.next':   'التالي',
    'dm.exit':   'إنهاء الجولة',
    'dm.end':    'نهاية الجولة',
    'dm.fin':    'من الفضاء إلى كويت أكثر اخضراراً',
    /* {n} is substituted by renderDemo() from DEMO.length, never typed.
       The numeral sits behind a definite article for the same reason
       js/ksat-shell.js does it: Arabic number-noun agreement changes
       shape between 3-10 and 11+, and this way one string is correct
       for any count. */
    'dm.fin2':   'الخطوات الـ{n}، مسار واحد، وكل رقم موسوم بما هو عليه.',
    'dm.again':  'إعادة الجولة',
    'dm.close':  'إغلاق',

    /* --- guardrails + audit section furniture --- */
    'gr.act':    'سارية',
    'gr.p':      'مطبَّق',
    'gr.c':      'تصميم فقط',
    'gr.before': 'قبل — معرَّض للاختراق',
    'gr.after':  'بعد — مُحصَّن',

    /* --- analyst panel. The four row labels matter more than they
           look: they are the headings that say which figures were
           measured and which were inferred (Spec 26), so leaving them
           in English on an Arabic page leaves the provenance
           distinction in a language the reader may not have. --- */
    'an.me':     'محلّل كويت سات',
    'an.you':    'أنت',
    'an.data':   'البيانات',
    'an.an':     'التحليل',
    'an.conf':   'الثقة',
    'an.rec':    'التوصية',
    'an.hi':     'أُجيب من سجلات ست محافظات، و 36 رصدة شهرية لكل منها، وخمسة مشاهد مُحاكاة، ومواصفات مهمة كويت سات-١ المنشورة. وكل إجابة تذكر أيّاً من هذه المصادر استخدمت. اختر سؤالاً أدناه أو اكتب سؤالك.',

    /* --- toasts and chart axis labels --- */
    't.copy':    'نُسخ التقرير.',
    /* Ctrl and Cmd stay in Latin here, deliberately. They are not words,
       they are the labels physically printed on the reader's keyboard,
       and an Arabic rendering would name a key that is not on it. The
       same applies to the {n} placeholder above: a token, not prose. */
    't.copy2':   'حُدّد التقرير — اضغط Ctrl/Cmd + C.',
    't.ref':     'حُدّثت اللوحة من بيانات العرض.',
    't.reg':     'المنطقة',
    't.reg2':    'المحافظة',
    't.sc':      'الدرجة',
    't.cov':     'نسبة الغطاء %',
    't.cov2':    'نسبة الغطاء الأخضر %',
    't.gp2':     'درجة إمكانية التشجير',
    't.lst2':    'حرارة الصيف °م',
    't.nd2':     'مؤشر الغطاء النباتي',
    't.st2':     'الإجهاد /100',

    /* --- provenance and map furniture --- */
    'src.cl':    'ادعاء ورد في هذه الصفحة',
    'src.sr':    'المصدر',
    'pass.in':   'نافذة الرصد فوق الكويت',
    'pass.out':  'خارج النطاق',
    'sys.loop':  'تكرار',
    'map.alt':   'محافظات الكويت ملوّنة حسب المؤشر المختار',
    'map.simp':  'هندسة مبسّطة · رسم تخطيطي',

    /* --- THE THREE DROPDOWNS THAT CAME BACK IN ENGLISH ---------------
           A handoff reported #dashPeriod, #vRange and #cmpMode as
           "hard-coded English markup ... never touched by fillSelect()".
           That diagnosis is wrong, and the distinction matters because
           it changes where the fix goes. All three ARE built through
           fillSelect() with T("p.12"), T("cm.w") and so on - the hand
           markup inside #cmpMode is overwritten by
           sel.innerHTML="" on the first render. What was missing was
           these six KEYS, right here. Rebuilding the markup would have
           left the page just as English.

           Numerals stay Western Arabic (0-9) to match every other
           figure on this page and the instruments the platform quotes,
           rather than switching to Eastern Arabic-Indic for these six
           strings alone. --- */
    'p.12':      'آخر 12 شهراً',
    'p.24':      'آخر 24 شهراً',
    'p.36':      'السجل الكامل (36 شهراً)',
    'cm.w':      'شريط المسح',
    'cm.s':      'جنباً إلى جنب',
    'cm.d':      'قناع التغيّر',

    /* --- THE ANALYST'S ANSWERS ---------------------------------------
           The four ROW LABELS were already translated above (an.data,
           an.an, an.conf, an.rec); the SENTENCES THEY LABEL were not,
           so an Arabic reader got Arabic headings over English prose.
           That was survivable while every Arabic question fell through
           to the refusal branch anyway. It stopped being survivable the
           moment classify() in index.html learned to route Arabic:
           the questions now reach the real branches, and the real
           branches have to be able to answer in the language asked.

           These strings are FRAGMENTS that index.html concatenates with
           numbers and region names between them - 'a.a6' is glued
           between regName(r) and a figure. So each one carries its own
           leading and trailing spaces exactly as the English does, and
           the Arabic is phrased so it still reads as one sentence when
           a Western-Arabic numeral lands in the middle of it. Changing
           the spacing here changes the rendered sentence. --- */
    'a.d1':      'درجات التشجير للمحافظات الست في مجموعة البيانات المرجعية، إلى جانب الغطاء الأخضر والإجهاد وحرارة السطح صيفاً.',
    'a.a1':      'الترتيب: ',
    'a.a1b':     'تجمع الثلاث الأولى بصمة واحدة: إجهاد مرتفع في النموذج، وغطاء قائم منخفض، ونسيج عمراني كثيف بما يكفي ليصل الظل إلى الناس.',
    'a.r1':      'البدء بـ ',
    'a.r1b':     '— ثم التحقق ميدانياً من توافر القطع ومصدر الري قبل أي قرار باختيار المواقع.',
    'a.d2':      'مجموعة المؤشرات لـ ',
    'a.d2b':     'الغطاء الأخضر، ومؤشر الغطاء النباتي، والإجهاد، وحرارة السطح صيفاً، والغبار، والمساحة التقريبية.',
    'a.a2':      ' الدرجة ',
    'a.a2b':     '/100 مدفوعة أساساً بالفجوة بين الإجهاد في النموذج (',
    'a.a2c':     ') والغطاء القائم (',
    'a.d3':      'خصائص مهمة كويت سات-١ المنشورة: دقة أرضية 39 متراً، وعرض مسح ≈ 80 كم، ومصوّر أحمر-أخضر-أزرق، وتنزيل عبر نطاق إس إلى جامعة الكويت.',
    'a.a3':      'عند 39 متراً يميّز الإطار المربّعات السكنية والحدائق والقطع الزراعية وخط الساحل — وهذا يكفي لتتبّع أين يظهر الغطاء الأخضر أو يختفي عبر الفصول والسنوات. ولا يكفي لعدّ الأشجار فرادى، كما أن متحسساً بـ أحمر-أخضر-أزرق وحده لا ينتج مؤشر غطاء نباتي حقيقياً، إذ يلزمه نطاق قريب من تحت الحمراء. والقيمة الحقيقية في تكرار التغطية: المكان نفسه، بالمتحسس نفسه، عبر الزمن.',
    'a.r3':      'تُعامَل بيانات الأقمار بوصفها طبقة الفرز التي تقرر أين يُرسل الناس، لا بوصفها القياس الذي يغني عنهم.',
    'a.d4':      'حقبتان مرسومتان من مشهد ',
    'a.d4b':     '، مطروحتان خلية بخلية على شبكة 39 متراً.',
    'a.a4':      'النسبة المغطاة بالنبات تتحرك بمقدار ',
    'a.a4b':     ' نقطة مئوية؛ ومتوسط مؤشر الغطاء النباتي بمقدار ',
    'a.a4c':     'وفرق بهذا الحجم يقع ضمن المدى الذي يمكن لتوقيت الفصول وحده أن ينتجه، فهو إشارة لا نتيجة.',
    'a.r4':      'تُقارَن عمليات التقاط من الشهر نفسه عبر السنوات قبل وصف هذا بأنه اتجاه، مع تأكيد ميداني.',
    'a.d5':      'درجة التشجير والإجهاد والغطاء عبر المحافظات جميعاً؛ العتبات مضبوطة حالياً عند إجهاد ≥ ',
    'a.d5b':     ' وإمكانية ≥ ',
    'a.a5':      'تتجاوز العتبتين معاً: ',
    'a.a5b':     'وبقية المناطق دون إحدى العتبتين على الأقل، وتبقى تحت المراقبة.',
    'a.r5':      'يُطلب مسح ميداني للمنطقتين الأوليين فقط. التحقق من كل شيء دفعة واحدة هو الطريقة التي تفقد بها طبقة الفرز فائدتها.',
    'a.d6':      'السلسلة الشهرية المرجعية لـ ',
    'a.d6b':     ' على مدى 36 شهراً الماضية: الإجهاد، ومؤشر الغطاء النباتي، والغطاء، وحرارة السطح، والغبار.',
    'a.a6':      ' يبلغ متوسطها ',
    'a.a6b':     'خلال الاثني عشر شهراً الماضية، بذروة في الصيف. نطاق الخطورة: ',
    'a.a6c':     'ويبلغ الغطاء الأخضر ',
    'a.a6d':     'وحرارة السطح صيفاً ',
    'a.d0':      'جرى فحص السؤال مقابل البيانات المتاحة: ست محافظات، و 36 سجلاً شهرياً لكل منها، وخمسة مشاهد محاكاة، وسجل مهمة كويت سات-١ المنشور.',
    'a.a0':      'لا شيء في تلك المجموعة يجيب عن هذا. ولن يبني المحلّل إجابة من خارج بياناته — وهذا هو المقصود من الضابط بأكمله.',
    'a.r0':      'جرّب أحد الأسئلة المقترحة، أو اسأل عن محافظة أو مقياس أو حقبة بعينها.',
    'a.none':    'لا شيء',
    /* New with the region-parser fix in index.html: said when the question
       named no governorate and the answer fell back to the map's current
       selection. */
    'a.which':   'لم يُذكر اسم محافظة في السؤال، لذا تخصّ هذه الإجابة المحافظة المحددة حالياً على الخريطة: ',

    /* --- the confidence, risk and provenance words the analyst prints
           alongside those answers. Without these the Arabic panel reads
           "الثقة: High". --- */
    'conf.high':   'عالية',
    'conf.medium': 'متوسطة',
    'conf.low':    'منخفضة',
    'risk.h':      'مرتفع',
    'risk.m':      'متوسط',
    'risk.l':      'منخفض',
    'tb.real':     'سجل مهمة كويت سات-١',
    'tb.demo':     'مجموعة بيانات مرجعية',
    'tb.sim':      'مُنمذَج',
    'tb.ai':       'تحليل مُشتقّ',
    'tb.none':     'لا توجد بيانات'
  };

  /* Our own layers, which the page knows nothing about. */
  var ARABIC_OURS = {
    'ksat.signin':   'دخول الباحثين',
    'ksat.signout':  'تسجيل الخروج',
    'ksat.assistant':'المساعد',
    'ksat.readmore': 'اقرأ المزيد',
    'ksat.readless': 'عرض أقل',
    'ksat.showall':  'عرض الكل',
    'ksat.showfewer':'عرض أقل',
    'ksat.chapters': 'الفصول',
    'ksat.lang':     'اللغة'
  };

  /* =================================================================
     2 · REACH THE PAGE'S OWN BINDINGS
     Classic scripts share one global lexical environment, so the bare
     names below resolve to index.html's declarations. `typeof` guards
     everything: a missing binding must degrade, never throw.
     ================================================================= */
  var haveAR = false;
  try {
    if (typeof AR !== 'undefined' && AR && typeof AR === 'object') {
      Object.assign(AR, ARABIC, ARABIC_OURS);   /* mutate, not reassign */
      haveAR = true;
    }
  } catch (e) { /* leave haveAR false */ }

  function setPageLang(code) {
    try { if (typeof LANG !== 'undefined') LANG = code; } catch (e) {}
  }
  function getPageLang() {
    try { if (typeof LANG !== 'undefined') return LANG; } catch (e) {}
    return 'en';
  }

  /* =================================================================
     3 · THE WALKER — the piece that never existed

     209 elements carry data-i18n and nothing read them. The English is
     captured on first pass so switching back is lossless; we never
     re-derive it from the dictionary.
     ================================================================= */
  var EN = new WeakMap();

  function translateDom(code) {
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i], key = n.getAttribute('data-i18n');
      if (!EN.has(n)) EN.set(n, n.textContent);
      if (code === 'ar' && ARABIC[key]) n.textContent = ARABIC[key];
      else n.textContent = EN.get(n);
    }
    /* Placeholders are an attribute, not text. */
    var inp = document.getElementById('anInput');
    if (inp) {
      inp.placeholder = (code === 'ar')
        ? 'اسأل عن إمكانية التشجير أو الحرارة أو التغيّر…'
        : 'Ask about greening potential, stress, change…';
    }
  }


  /* -----------------------------------------------------------------
     THE PROVENANCE BADGES

     These carry no data-i18n: they are static text inside
     <span class="badge …">, written straight into the markup. They are
     also the most important text on the page for honesty, so leaving
     them English on an Arabic page would be the worst place of all to
     leave a gap — an Arabic reader would see every figure and not the
     label saying whether it was measured or modelled.

     Matched on their exact English, with the typographic mark kept:
     ▦ ◈ ⬡ ↗ 🛰 🏛 carry the meaning across both languages and appear
     under the same marks in the legend.
     ----------------------------------------------------------------- */
  var BADGES = {
    '🛰 KuwaitSat-1 mission record': '🛰 سجل مهمة KuwaitSat-1',
    '🛰 Acquisition record · image at source': '🛰 سجل الالتقاط · الصورة في مصدرها',
    '🛰 Acquisition record': '🛰 سجل الالتقاط',
    '🛰 Measured footprint': '🛰 بصمة مقاسة',
    '🛰 Measured': '🛰 مُقاس',
    '🛰 Published record': '🛰 سجل منشور',
    '🛰 Published': '🛰 منشور',
    '🛰 Verified dates': '🛰 تواريخ مُتحقَّق منها',
    '🛰 Verified': '🛰 مُتحقَّق منه',

    '▦ Reference dataset': '▦ مجموعة بيانات مرجعية',
    '▦ Reference': '▦ مرجعية',

    '◈ Modelled — not live telemetry': '◈ مُنمذَج — لا قياس حيّ عن بُعد',
    '◈ Modelled scenario': '◈ سيناريو مُنمذَج',
    '◈ Modelled scenes': '◈ مشاهد مُنمذَجة',
    '◈ Modelled scene': '◈ مشهد مُنمذَج',
    '◈ Modelled': '◈ مُنمذَج',

    '⬡ Derived analysis': '⬡ تحليل مُشتقّ',
    '⬡ Derived interpretation': '⬡ تفسير مُشتقّ',
    '⬡ Derived': '⬡ مُشتقّ',
    '⬡ Model output': '⬡ مخرجات النموذج',
    '⬡ Agent workflow': '⬡ مسار الوكيل',
    '⬡ Decision support': '⬡ دعم القرار',
    '⬡ Rule-based, in-page': '⬡ قائم على قواعد، داخل الصفحة',
    '⬡ Generated': '⬡ مُولَّد',

    '↗ Projection': '↗ إسقاط',
    '↗ Estimate': '↗ تقدير',

    '🏛 Public data': '🏛 بيانات عامة',
    'Assisted workflow': 'مسار مُعان',
    'Alignment': 'المواءمة',
    'EXTERNAL MEDIA BLOCKED': 'الوسائط الخارجية محجوبة'
  };

  var CHAPTERS_AR = {
    'Chapters': 'الفصول',
    'Mission Record': 'سجل المهمة',
    'Kuwait From Space': 'الكويت من الفضاء',
    'Intelligence': 'التحليل',
    'Planning': 'التخطيط',
    'Agents': 'الوكلاء',
    'Story & Accountability': 'القصة والمصداقية'
  };


  /* =====================================================================
     LEAF LABELS THE PAGE BUILDS IN JAVASCRIPT

     The data-i18n sweep only reaches nodes the markup marked. A great deal
     of this page is written by its own render functions from arrays that
     carry an English string and no Arabic one — axis labels, table heads,
     readouts, telemetry chips. In Arabic those stayed English, and the team
     asked for the opposite: "when it is in english never put any words in
     arabic same goes to arabic".

     Measured before this table existed: 171 Latin text nodes survived a
     switch to Arabic. Most were these.

     WHAT IS DELIBERATELY NOT HERE, because translating it would be wrong:
       - publication titles and author strings in the source register. You
         do not translate the name of a paper you are citing.
       - COSPAR 2023-001CY. An international designator, not a phrase.
       - CSV, JSON. File format names.
       - file paths such as js/ksat-integration.js.
     Those keep their Latin in both languages and that is correct.
     ===================================================================== */
  var LABELS = {
    /* readouts and controls */
    'Altitude':'الارتفاع', 'Velocity':'السرعة', 'Inclination':'الميل المداري',
    'Orbital period':'الزمن المداري', 'Orbit position':'الموضع المداري',
    'Range to Kuwait':'المسافة إلى الكويت', 'Pass status':'حالة المرور',
    'Latitude':'خط العرض', 'Longitude':'خط الطول',
    'Camera rotation':'دوران الكاميرا', 'Camera tilt':'ميل الكاميرا',
    'Extrusion height':'ارتفاع التجسيم', 'Reset view':'إعادة ضبط العرض',
    'Zoom':'التقريب', 'Resolution':'الدقة', 'Footprint':'البصمة الأرضية',
    'Acquired':'تاريخ الالتقاط', 'Credit':'نسبة العمل',
    'OUT':'خارج', 'OUT OF RANGE':'خارج المدى', 'min':'دقيقة', 'in-page':'داخل الصفحة',
    'No simulated passes recorded yet. Let the model run.':
      'لا توجد عمليات مرور محاكاة بعد. شغّل النموذج.',

    /* the provenance register's table head */
    'Dataset or layer':'مجموعة البيانات أو الطبقة', 'Class':'التصنيف',
    'Used by':'تُستخدم في', 'Source':'المصدر', 'Self-assessment':'تقييم ذاتي',
    'View at source ↗':'عرض في المصدر ↗',

    /* provenance classes, in the same words the legend cards use */
    'MEASURED':'مقيس', 'MODELLED':'مُنمذَج', 'MODEL OUTPUT':'مخرجات النموذج',
    'PUBLIC DATA':'بيانات عامة', 'REFERENCE DATASET':'مجموعة مرجعية',
    'ESTIMATED':'مُقدَّر', 'NOT VERIFIED':'غير مُتحقَّق منه',
    'PUBLISHED SOURCE':'مصدر منشور',

    /* the ground segment's telemetry chips */
    'UHF':'التردد فوق العالي', 'S-BAND':'نطاق إس', 'IMAGE DL':'تنزيل الصور',
    'OCT 2022':'أكتوبر ٢٠٢٢', 'STATUS':'الحالة',

    /* dates and figures the render functions format in English */
    '3 Jan 2023':'٣ يناير ٢٠٢٣', '5 April 2023':'٥ أبريل ٢٠٢٣',
    '2U CubeSat · 2 kg':'قمر مكعّب ٢ وحدة · ٢ كجم',

    /* islands: the page's own ISLANDS array already carries these */
    'Bubiyan':'بوبيان', 'Failaka':'فيلكا', 'Warba':'وربة',

    /* attribution lines */
    'Kuwait University':'جامعة الكويت',
    'KuwaitSat-1 project':'مشروع كويت سات-١',
    'KuwaitSat-1 project · Kuwait University':'مشروع كويت سات-١ · جامعة الكويت',
    'Kuwait Vision 2035 — the seven official pillars':'رؤية الكويت ٢٠٣٥ — الركائز السبع الرسمية',
    'FROM SPACE TO A GREENER KUWAIT':'من الفضاء إلى كويت أكثر خضرة',

    /* the footer wordmark. A brand, but the team's rule is absolute and the
       seal beside it already carries the Latin form inside its ring. */
    'KUWAITSAT':'كويت سات', 'GREEN INTELLIGENCE':'الذكاء البيئي',

    /* Found by re-running the sweep after the first pass: HUD strings the
       render functions compose from a symbol and a phrase. */
    '◈ MODELLED ORBIT · NOT LIVE TELEMETRY':'◈ مدار مُنمذَج · ليس قياساً حيّاً',
    '≈ 80 km frame':'إطار بعرض نحو ٨٠ كم',
    '◈ EXTRUSION':'◈ التجسيم'
  };

  function translateLabels(code) {
    var ar = code === 'ar';
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    var n, hits = [];
    while ((n = w.nextNode())) {
      var v = (n.nodeValue || '').trim();
      if (!v || v.length > 60) continue;
      var e = n.parentElement;
      if (!e) continue;
      /* Never touch the citation panel or anything explicitly marked as
         being in a language: those are deliberate. */
      if (e.closest('.ksx-citerow') || e.closest('code') || e.closest('pre')) continue;
      hits.push(n);
    }
    for (var i = 0; i < hits.length; i++) {
      var node = hits[i];
      /* NEVER CACHE ARABIC AS THE ENGLISH ORIGINAL. A render function that
         runs while the page is already in Arabic writes fresh nodes, and
         this sweep would then remember that Arabic as the thing to restore
         on the way back. Observed exactly once - "خارج النطاق" survived a
         switch back to English - which is how the guard got written. */
      if (!EN.has(node)) {
        var raw = (node.nodeValue || '').trim();
        if (/[؀-ۿ]/.test(raw)) continue;   // not ours to own
        EN.set(node, raw);
      }
      var src = EN.get(node);
      if (!src) continue;
      /* Some HUD strings are composed at runtime as "PREFIX: value", where
         the value is already Arabic and only the prefix is not. An exact
         match cannot see those, so the prefix is matched on its own. */
      var pre = null;
      if (ar && !LABELS[src]) {
        var ci = src.indexOf(': ');
        if (ci > 0 && LABELS[src.slice(0, ci)]) {
          pre = LABELS[src.slice(0, ci)] + ': ' + src.slice(ci + 2);
        }
      }
      if (ar && pre) {
        if (node.nodeValue.trim() !== pre) node.nodeValue = pre;
      } else if (ar && LABELS[src]) {
        if (node.nodeValue.trim() !== LABELS[src]) node.nodeValue = LABELS[src];
      } else if (!ar && node.nodeValue.trim() !== src) {
        node.nodeValue = src;
      }
    }
  }

  function translateBadges(code) {
    var ar = code === 'ar';
    var nodes = document.querySelectorAll('.badge');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!EN.has(n)) EN.set(n, n.textContent.trim());
      var src = EN.get(n);
      n.textContent = (ar && BADGES[src]) ? BADGES[src] : src;
    }
  }

  function translateChapters(code) {
    var ar = code === 'ar';
    /* The chapter control is built by js/ksat-shell.js, which knows
       nothing about language, so its labels are matched on English. */
    var nodes = document.querySelectorAll('#ksat-ch-rail *, #ksat-ch-sheet *, #ksat-ch-fab');
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.children.length) continue;                  /* leaf text only */
      if (!EN.has(n)) EN.set(n, n.textContent.trim());
      var src = EN.get(n);
      if (!src) continue;
      if (ar && CHAPTERS_AR[src]) { n.textContent = CHAPTERS_AR[src]; continue; }
      /* "Ch 1/6 · Mission Record" — keep the numerals, translate the name */
      var m = src.match(/^Ch (\d+\/\d+) · (.+)$/);
      if (ar && m && CHAPTERS_AR[m[2]]) { n.textContent = 'فصل ' + m[1] + ' · ' + CHAPTERS_AR[m[2]]; continue; }
      n.textContent = src;
    }
  }

  /* Our own layers carry no data-i18n, so they are named explicitly. */
  function translateOurs(code) {
    var ar = code === 'ar';
    function set(sel, key) {
      var n = document.querySelector(sel);
      if (!n) return;
      if (!EN.has(n)) EN.set(n, n.textContent);
      n.textContent = ar && ARABIC_OURS[key] ? ARABIC_OURS[key] : EN.get(n);
    }
    set('#ksat-signin', 'ksat.signin');
    set('.ksat-who-out', 'ksat.signout');
    set('.ksat-as-fab-label', 'ksat.assistant');
    document.querySelectorAll('.ksat-fold-word').forEach(function (w) {
      if (!EN.has(w)) EN.set(w, w.textContent);
      var wasMore = /more|المزيد|الكل/i.test(EN.get(w));
      if (!ar) { w.textContent = EN.get(w); return; }
      w.textContent = wasMore ? ARABIC_OURS['ksat.readmore'] : ARABIC_OURS['ksat.readless'];
    });
  }

  /* =================================================================
     4 · THE SWITCH

     applyLang() in the page hard-codes en/ltr. It is a function
     DECLARATION, so it is a property of the global object and can be
     replaced there — unlike `const AR`, which can only be mutated.
     The original is kept and still called, because it also runs
     renderAll(), which redraws every chart with the new strings.
     ================================================================= */
  var originalApplyLang = (typeof window.applyLang === 'function') ? window.applyLang : null;

  function apply(code) {
    var ar = code === 'ar';
    var root = document.documentElement;

    setPageLang(code);
    root.lang = ar ? 'ar' : 'en';
    root.dir  = ar ? 'rtl' : 'ltr';
    root.setAttribute('data-ksat-lang', code);

    translateDom(code);

    /* The page's own renderAll() repaints every canvas and JS-rendered
       string. Call it through the original, with the hard-coded lang
       lines now overridden by ours above — it sets them again, so ours
       are re-applied immediately after. */
    try { if (originalApplyLang) originalApplyLang(); } catch (e) {}
    root.lang = ar ? 'ar' : 'en';
    root.dir  = ar ? 'rtl' : 'ltr';
    translateDom(code);
    translateOurs(code);
    translateBadges(code);
    translateChapters(code);
    translateLabels(code);

    try { localStorage.setItem('ksat.lang', code); } catch (e) {}
    try {
      document.dispatchEvent(new CustomEvent('ksat:lang', { detail: { lang: code } }));
    } catch (e) {}
    paintToggle(code);
  }

  /* =================================================================
     5 · THE CONTROL — built here, so index.html gains no markup
     ================================================================= */
  var toggle = null;

  function buildToggle() {
    var act = document.querySelector('.bar-act');
    if (!act || document.getElementById('ksat-lang')) return;

    var wrap = document.createElement('div');
    wrap.id = 'ksat-lang';
    wrap.className = 'lang ksat-lang';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Language / اللغة');

    [['en', 'EN', 'English'], ['ar', 'AR', 'العربية']].forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = p[1];
      b.setAttribute('data-lang', p[0]);
      b.setAttribute('lang', p[0]);
      b.setAttribute('aria-label', p[2]);
      b.addEventListener('click', function () { apply(p[0]); });
      wrap.appendChild(b);
    });

    /* Before the sign-in button, so language sits with the other
       utilities rather than after the primary action. */
    var signin = document.getElementById('ksat-signin');
    if (signin) act.insertBefore(wrap, signin);
    else act.appendChild(wrap);
    toggle = wrap;
  }

  function paintToggle(code) {
    if (!toggle) return;
    toggle.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-lang') === code ? 'true' : 'false');
    });
  }

  /* =================================================================
     6 · BOOT
     ================================================================= */
  function start() {
    if (!haveAR) {
      console.warn('[ksat-i18n] the page\'s AR object was not reachable; Arabic is unavailable.');
    }
    buildToggle();

    var saved = null;
    try { saved = localStorage.getItem('ksat.lang'); } catch (e) {}
    /* Respect an explicit choice; otherwise follow the browser, but only
       if it actually asks for Arabic. */
    var want = saved || ((navigator.language || '').toLowerCase().indexOf('ar') === 0 ? 'ar' : 'en');
    apply(want);

    /* The masthead is built asynchronously by the shell, so the toggle
       may have missed its slot. Try once more when identity settles. */
    document.addEventListener('ksat:identity', function () {
      if (!document.getElementById('ksat-lang')) { buildToggle(); paintToggle(getPageLang()); }
    });

    KS.i18n = {
      apply: apply,
      lang: getPageLang,
      keys: Object.keys(ARABIC).length
    };
  }

  function boot() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      if (document.querySelector('[data-i18n]') || tries > 60) { clearInterval(iv); start(); }
    }, 120);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
