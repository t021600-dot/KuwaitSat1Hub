/* =====================================================================
   ksat-i18n.js — ARABIC, AND THE SWITCH THAT WAS MISSING
   Owner: 01 Front End

   WHAT WAS ACTUALLY BROKEN — this is worth reading before changing it.

   The page looks bilingual. It carries 209 `data-i18n` attributes, a
   `tr()` helper, a `T()` helper, an `applyLang()` function and CSS for a
   `.lang` toggle. Almost none of it worked:

     1 · `const AR = {}` — the dictionary was EMPTY. index.html:1841 says
         "English-only build: the bilingual layer was removed on request."
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
    'intro.plate':'KUWAITSAT-1 · تسلسل الإطلاق · إعادة',
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
    'hero.lede': 'ينظر KuwaitSat-1 إلى الأسفل. هذه المنصة هي الطبقة التي تحوّل ما يراه القمر الصناعي إلى ما يمكن لمخطِّط أن يتصرف بناءً عليه — مسار تشغيلي يمتد من الصور، إلى التحليل البيئي، إلى توصية للتشجير.',
    'hero.cta1': 'محاكاة كويت أكثر اخضراراً',
    'hero.cta2': 'ابدأ الجولة الإرشادية',

    /* --- mission facts --- */
    'fact.k1':   'تاريخ الإطلاق',
    'fact.k2':   'المنصة',
    'fact.k3':   'دقة التصوير الأرضية',
    'fact.k4':   'عرض المسح',
    'fact.note': 'مواصفات موثّقة من ورقة المهمة المنشورة لفريق مشروع KuwaitSat-1 ومن إصدارات جامعة الكويت. المصادر مدرجة في أسفل هذه الصفحة.',

    /* --- the legend: the provenance key --- */
    'leg.eyebrow':'كيف تُقرأ هذه المنصة',
    'leg.h':     'كل لوحة تُعلن عن طبيعتها',
    'leg.lede':  'على منصة تجمع بين القياس والنمذجة واجب واحد: ألّا تدع القارئ يخلط بينهما أبداً. كل رسم بياني وخريطة وصورة على هذا الموقع يحمل إحدى هذه العلامات الأربع.',
    'leg.p1':    'واقعة أو صورة منشورة ومنسوبة إلى KuwaitSat-1 وفريق مشروعه. المصدر مرتبط دائماً.',
    'leg.p5':    'إحصاءات رسمية مفتوحة — البنك الدولي، المنظمة العالمية للأرصاد الجوية، منشورات حكومية كويتية. يُعرض الرقم وسنته وجهة نشره.',
    'leg.p4':    'مجموعة بيانات مرجعية، مُنمذَجة على أنماط بيئية كويتية منشورة، وتُستخدم بالاتساق نفسه في كل لوحة.',
    'leg.p2':    'قيم ناتجة عن النموذج البيئي للمنصة. متسقة فيزيائياً، مُشتقّة لا مُقاسة.',
    'leg.p3':    'تفسير يولّده المحلّل القائم على القواعد داخل هذه الصفحة. دعم للقرار، وليس قراراً.',
    'leg.unv':   'حين يتعذّر التحقق من تفصيلة عبر مصدر موثوق، تقول المنصة ذلك بدلاً من التفصيلة: «معلومة غير مُتحقَّق منها بشكل مستقل».',
    'leg.warn':  'لا شيء على هذا الموقع يمثّل مقترح تخطيط رسمياً أو توصية حكومية، ولا تحمل أي لوحة بيانات قياس حيّة من القمر الصناعي. هذه منصة ذكاء بيئي مبنية على سجل مهمة KuwaitSat-1.',

    /* --- the spacecraft --- */
    'mis.eyebrow':'المركبة الفضائية',
    'mis.h':     'KuwaitSat-1 في السجل',
    'mis.lede':  'أول قمر صناعي وطني للكويت هو CubeSat من فئة 2U بناه فريق من جامعة الكويت. كل ما في هذا الجدول منشور من المشروع أو شركائه — وهذه المنصة مبنية فوقه، لا فوق ادعاءات لم تقدّمها المركبة.',
    'mis.spec':  'سجل المهمة',
    'mis.note':  'الهدف الأساسي المعلن للقمر الصناعي كان بناء القدرات واختبار ما إذا كانت الكاميرا تدعم تحديد الاتجاه — لا الرصد البيئي التشغيلي. وتقترح هذه المنصة الطبقة التحليلية التي يمكن لمهمة كهذه أن تغذّيها.',
    'mis.chain': 'سلسلة المفهوم',
    'mis.gs':    'القطاع الأرضي',
    'mis.gsp':   'دخلت المحطة الأرضية في كلية العلوم بجامعة الكويت الخدمة في أكتوبر 2022: هوائي UHF للقياس عن بُعد والتتبّع والتحكم، وهوائي S-band لتنزيل الصور، وكلاهما على وحدات تدوير.',
    'mis.live':  'الحالة',
    'desc.a':    'تنزيل البيانات',
    'desc.b':    'المحطة الأرضية · جامعة الكويت',
    'desc.c':    'من بنَوه',

    /* --- the builders --- */
    'blt.eyebrow':'من القمر الصناعي، عودةً إلى الناس',
    'blt.badge2':'⚠ صورة مقدَّمة',
    'blt.h':     'الفريق وراء KuwaitSat-1',
    'blt.lede':  'كل إطار في هذه المنصة يبدأ بمركبة فضائية صمّمها ودمجها واختبرها كويتيون، ويشغّلونها اليوم من حرم جامعي في مدينة الكويت. بُني أول قمر صناعي وطني للكويت على يد طلبة وكوادر جامعة الكويت بقيادة مديرة المشروع الدكتورة هالة الجسار، بدعم من مؤسسة الكويت للتقدم العلمي وهيئة الاتصالات وتقنية المعلومات وشركاء آخرين.',
    'blt.who':   'من هم',
    'blt.note':  'يذكر الموقع الرسمي للمشروع قيادته وفريق التحكم وأعضاءه بالاسم. أما الأعداد التي أوردتها الصحافة الكويتية حول الإطلاق — دفعة اختيرت من عدد أكبر بكثير من المتقدمين، وتعمل منذ 2019 — فتُنسب إلى تلك التقارير ولا تُعاد هنا بوصفها نتيجة توصّلنا إليها.',
    'blt.tl':    'الخط الزمني للمشروع',

    /* --- imagery --- */
    'img.eyebrow':'مُلتقَط من الفضاء',
    'img.h':     'مُلتقَط من الفضاء',
    'img.lede':  'في 5 أبريل 2023 أعاد KuwaitSat-1 أولى سلاسل صوره للكويت — خمسة إطارات متتالية، عرض كل منها نحو 80 كم، جمعها فريق المشروع في فسيفساء للنصف الشرقي من البلاد.',
    'img.disc':  'الصور الفوتوغرافية نفسها ملك لمشروع KuwaitSat-1 وجامعة الكويت، وهي غير منسوخة داخل هذه المنصة. كل إطار أدناه يسجّل عملية الالتقاط الحقيقية — البصمة الأرضية والتاريخ والدقة ونسبة الحقوق — ويرتبط بجهة النشر حتى يمكن الاطلاع على الأصل في مصدره.',
    'img.mos':   'بصمة الفسيفساء · 5 أبريل 2023',
    'img.mosp':  'مواضع سقوط الإطارات الخمسة، مرسومة وفق عرض المسح المنشور البالغ 80 كم فوق مخطط مبسّط لحدود البلاد. البصمة حقيقية، أما المخطط فرسم تخطيطي لا منتج مساحي.',

    /* --- explorer --- */
    'exp.eyebrow':'مستكشف الصور',
    'exp.h':     'مستكشف صور القمر الصناعي',
    'exp.lede':  'عارض عملي لرصد الأرض: حرّك وقرّب وبدّل الطبقات التحليلية وتنقّل عبر الحقب الزمنية. المشهد الأساسي تولّده هذه الصفحة على شبكة أخذ عيّنات مقدارها 39 م — وهي دقة KuwaitSat-1 الأرضية — فيسلك الواجهة سلوك الأداة الحقيقية دون أن يُقدَّم إطار مُركَّب على أنه حقيقي.',
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
    'map.lede':  'محافظات الكويت الست، مُقيَّمة بنموذج التشجير الخاص بـ KuwaitSat-1. اختر منطقة لترى ما نظر إليه النموذج ولماذا منحها هذه الدرجة. الدرجة العالية دعوة للفحص — لا أمر بالزراعة.',
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
    'orb.h':     'أين KuwaitSat؟',
    'orb.lede':  'مُحرِّك مدار دائري مبسّط يعمل داخل متصفحك، مُهيَّأ بالمعاملات الاسمية للمدار المتزامن مع الشمس لعملية نشر Transporter-6. هو نموذج تعليمي: لا يقرأ عناصر TLE، وليس متصلاً بمحطة أرضية، والأرقام أدناه تُحسب هنا ولا تُستقبل من الفضاء.',
    'orb.pause': 'إيقاف مؤقت',
    'orb.reset': 'إعادة ضبط',
    'orb.speed': 'تسريع الزمن ·',
    'orb.pass':  'نافذة الرصد',
    'orb.tel':   'قراءة القياس عن بُعد',
    'orb.warn':  'قيم مُحاكاة. هذه مخرجات نموذج جسمين دائري بميل ثابت، لا قياسات. التنبؤ الحقيقي بالمرور يتطلب عناصر مدارية محدَّثة ومُحرِّك انتشار صحيح.',
    'orb.log':   'سجل المرور',

    /* --- analyst --- */
    'an.eyebrow':'المحلّل البيئي',
    'an.h':      'محلّل KuwaitSat الذكي',
    'an.lede':   'اطرح سؤالاً عن مجموعة البيانات. يجيب المحلّل بهيكل ثابت — ما نظر إليه، وما وجده، ودرجة ثقته، وما يقترحه تالياً، ونوع البيانات التي يستند إليها الجواب. ويعمل بالكامل داخل هذه الصفحة على مجموعة البيانات المرجعية: لا نموذج خارجي ولا مفتاح واجهة برمجية ولا أي اتصال بالشبكة.',
    'an.sess':   'جلسة المحلّل',
    'an.clear':  'مسح',
    'an.send':   'اسأل',
    'an.guard':  'الضابط مُفعَّل: يرفض المحلّل الأسئلة التي لا يملك بيانات عنها، ويوسم نوع بيانات كل إجابة.',

    /* --- the agent --- */
    'ag.eyebrow':'الأتمتة',
    'ag.h':      'وكيل KuwaitSat البيئي',
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
    'tm.eyebrow':'فريق المشروع',
    'tm.h':      'تعرّف على الفريق',
    'tm.lede':   'أربعة أدوار، وأربع مساهمات قابلة للدفاع عنها. تذكر كل بطاقة ما يمكن سؤال صاحبها عنه أثناء التحكيم.',
    'tm.note':   'تصف كل بطاقة الدور والمساهمة التي يملكها ذلك العضو، والأقسام أعلاه مكتوبة لتطابقها.',

    /* --- sources --- */
    'src.eyebrow':'التحقق',
    'src.h':     'المصادر ومنشأ البيانات',
    'src.lede':  'هذا الجدول هو سجل التدقيق. إن ظهر أي قول عن KuwaitSat-1 في أي موضع من هذه الصفحة، فهو مدرج هنا مع مصدره. وكل ما ليس في هذا الجدول فهو مُحاكى أو مُنمذَج أو تصوّري، وموسوم بذلك حيث يظهر.',
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
    'ft.l1':     'غير منتسبة إلى جامعة الكويت أو مؤسسة الكويت للتقدم العلمي أو مشروع KuwaitSat-1.',
    'ft.l2':     'لا قياس حيّ عن بُعد. ولا صفة تخطيط رسمية.',
    'ft.l3':     'تبقى صور الأقمار الصناعية ملكاً لناشريها.',
    'ft.l4':     'تعمل بالكامل داخل متصفحك. ولا تغادر أي بيانات هذه الصفحة.'
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
