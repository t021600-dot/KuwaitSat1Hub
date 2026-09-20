KUWAITSAT GREEN INTELLIGENCE
A research console for KuwaitSat-1 researchers
================================================================

WHAT THIS IS
------------
A working prototype. A researcher states an objective, sets an area
and a period, and seven AI agents take it from satellite acquisition
through environmental analysis, species selection, predicted impact,
costed visualisation, post-deployment monitoring and a written report.

Everything runs inside one HTML file. No server, no install, no
internet connection required, no API keys, no data leaves the page.


HOW TO OPEN IT
--------------
1. Unzip this folder anywhere.
2. Double-click  index.html
3. It opens in your default browser.

Tested in Chrome, Edge and Safari. Firefox works too.
Works offline. Two things need internet, and both degrade gracefully:
  - the web fonts (falls back to system fonts)
  - the YouTube clip in the intro (falls back to a labelled notice)


THE FIRST SCREEN
----------------
The site opens on a black screen with two buttons:

    [ Begin with sound ]   [ Begin muted ]

Choose "Begin with sound" for the full launch sequence. Browsers block
audio until you click, which is why the choice exists. The countdown
does not start until you pick one.

The sound is generated in the browser from oscillators and filtered
noise. No recording is used and none is implied to be official.

"Skip intro" is bottom right if you have seen it already.


DEMO ORDER FOR JUDGING
----------------------
There is a "Demo mode" button in the top bar that walks through the
whole project in eleven steps. If you would rather drive it yourself:

  1. Let the intro run  (sound on)
  2. The Team Behind KuwaitSat-1  - the photograph and the tribute
  3. Research Console  - click an example objective, press Start
  4. Let all five agents finish, open each one and read its working
  5. Press "Mark as deployed"  - the monitoring agent starts
  6. Press "Complete study"  - the report is written
  7. Switch the report to Arabic with the toggle
  8. Greening Potential Map  - click a governorate
  9. Sources & data provenance  - the honesty section

The two buttons inside the console - "Mark as deployed" and
"Complete study" - are deliberate human gates. The agents stop and
wait for a person. Say this out loud during judging; it is the point.


WHAT TO EDIT BEFORE YOU PRESENT
-------------------------------
Open index.html in any text editor (VS Code, Notepad, TextEdit) and
search for these two blocks near the top of the script.

1) YOUR NAMES
   Search for:   const TEAM = [
   Replace "Team member 1" ... "Team member 5" with the real names.
   Leave roleKey alone - the roles and contributions are already
   written to match the sections of the site.

2) THE TEAM PHOTOGRAPH
   Search for:   const TEAM_PHOTO = {
   The KuwaitSat-1 team photograph is already embedded.
   If you obtain a higher-resolution version or a formal credit line,
   update "url" and "credit" here.
   Set  verified: true  ONLY once you can point to the publisher.

Save the file. That is all. There is nothing to rebuild.


WHAT IS REAL AND WHAT IS NOT
----------------------------
Every panel on the site carries one of five badges. This is the most
important thing to be able to explain:

  REAL DATA         published, attributable KuwaitSat-1 facts
  PUBLIC DATA       World Bank, WMO, Kuwaiti government publications
  DEMO DATA         illustrative dataset built for this prototype
  SIMULATED         produced by a model written for this page
  CONCEPTUAL MODEL  interpretation by the in-page rule-based analyst

Where something could not be verified the site says
"Information not independently verified" instead of guessing.

The scientific numbers in the species and impact agents come from
peer-reviewed papers, cited in the report and listed in
CREDITS-AND-SOURCES.txt.

Planting costs are NOT asserted. The costing panel asks the
researcher for their own unit rates and shows the arithmetic.


KNOWN LIMITS - SAY THESE BEFORE A JUDGE DOES
--------------------------------------------
- KuwaitSat-1 carries an RGB imager and no thermal sensor and no
  near-infrared band. The heat and vegetation layers here are
  model-derived, not satellite measurements.
- The orbit readout is a circular two-body model initialised with
  nominal sun-synchronous parameters. It is not live telemetry and
  does not read a TLE.
- The cooling coefficient is peer-reviewed but was not derived in
  Kuwait, and the source states the relationship is non-linear.
- The site is a student capstone prototype. It carries no official
  endorsement and no planning authority.


FILES IN THIS FOLDER
--------------------
  index.html                            the entire application
  README.txt                            this file
  CREDITS-AND-SOURCES.txt               all 16 sources with links
  assets/kuwaitsat1-team-photo.webp     the team photograph, as supplied
                                        (also embedded inside index.html)


IMAGE PERMISSION - IMPORTANT
----------------------------
The KuwaitSat-1 team photograph is included for the academic
presentation. Before publishing this site publicly, confirm the
permission scope and the exact credit line with the KuwaitSat-1
project. The credit line lives in one place: the TEAM_PHOTO block.


================================================================

نظرة عامة بالعربية
================================================================

ما هذا المشروع
--------------
نموذج أولي يعمل فعلياً. الباحث يكتب هدف بحثه ويحدد المنطقة والفترة،
ثم تتولى سبعة وكلاء ذكاء اصطناعي المهمة: من التقاط بيانات الأقمار
إلى التحليل البيئي، واختيار الأنواع النباتية، وتوقع الأثر، والتصور
المُسعَّر، والمراقبة بعد التنفيذ، وأخيراً تقرير مكتوب.

كل شيء يعمل داخل ملف HTML واحد. بلا خادم، وبلا تثبيت، وبلا اتصال
بالإنترنت، وبلا مفاتيح واجهات برمجية، ولا تغادر أي بيانات الصفحة.


كيف تفتحه
---------
فُكّ ضغط المجلد، ثم انقر نقرتين على  index.html

تفتح الصفحة على شاشة سوداء فيها زران:
    [ ابدأ مع الصوت ]   [ ابدأ بدون صوت ]

المتصفحات تمنع الصوت قبل أن ينقر المستخدم، ولهذا وُجد هذا الاختيار.
والعدّ التنازلي لا يبدأ قبل أن تختار.

الصوت كله مُصنَّع داخل المتصفح. لا يوجد أي تسجيل منسوخ.


ما الذي يجب تعديله قبل العرض
----------------------------
افتح index.html بأي محرر نصوص وابحث عن:

  const TEAM = [        ← ضع أسماء الفريق الخمسة مكان العناصر النائبة
  const TEAM_PHOTO = {  ← صورة الفريق مضمَّنة بالفعل؛ عدّل الإسناد هنا

ثم احفظ الملف. لا يوجد شيء آخر يُبنى أو يُجمَّع.


ترتيب العرض أمام المحكّمين
--------------------------
  ١. اترك المقدمة تعمل مع الصوت
  ٢. قسم «الفريق وراء كويت سات-١» — الصورة والإهداء
  ٣. الـ Research Console — اضغط مثالاً جاهزاً ثم Start
  ٤. افتح كل وكيل واقرأ عمله
  ٥. اضغط "Mark as deployed" — يبدأ وكيل المراقبة
  ٦. اضغط "Complete study" — يُكتب التقرير
  ٧. بدّل التقرير إلى العربية
  ٨. خريطة إمكانية التشجير — اضغط على محافظة
  ٩. قسم المصادر ومصدر البيانات

الزرّان داخل الكونسول بوابتان بشريتان مقصودتان: الوكلاء يتوقفون
وينتظرون قرار الإنسان. اذكر هذا صراحةً أمام المحكّمين — فهذه هي الفكرة.


الحدود التي يجب ذكرها قبل أن يسألك المحكّم
------------------------------------------
- كويت سات-١ يحمل مصوّراً ملوناً فقط، بلا مستشعر حراري وبلا نطاق
  قريب من تحت الحمراء. فطبقات الحرارة والنبات هنا مشتقة من النموذج.
- قراءة المدار نموذج تعليمي وليست قياسات حية.
- معامل التبريد محكَّم لكنه لم يُشتق في الكويت.
- هذا مشروع تخرّج طلابي، بلا اعتماد رسمي وبلا صفة تخطيطية.


إذن الصورة — مهم
-----------------
صورة فريق كويت سات-١ مُدرجة لأغراض العرض الأكاديمي. قبل النشر العام،
تأكد من نطاق الإذن وصيغة الإسناد مع مشروع كويت سات-١. وسطر الإسناد
موجود في مكان واحد فقط: كتلة TEAM_PHOTO.
