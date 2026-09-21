import os, json, collections, re, unicodedata

COUNTRIES = [
 ("SA","السعودية"),("AE","الإمارات"),("QA","قطر"),("KW","الكويت"),("BH","البحرين"),
 ("OM","عُمان"),("YE","اليمن"),("IQ","العراق"),("JO","الأردن"),("LB","لبنان"),
 ("SY","سوريا"),("PS","فلسطين"),("EG","مصر"),("SD","السودان"),("LY","ليبيا"),
 ("TN","تونس"),("DZ","الجزائر"),("MA","المغرب"),("MR","موريتانيا"),("SO","الصومال"),
 ("DJ","جيبوتي"),("KM","جزر القمر"),
]

# أسماء ناقصة أو مغلوطة في المصدر — تصحيح يدوي بالاسم الرسمي
OVERRIDE = {
 # السعودية
 "106280":"حائل",
 # قطر
 "11777514":"الشحانية",
 # الكويت
 "7733358":"مبارك الكبير",
 # المغرب — جهات
 "11281877":"الرباط سلا القنيطرة",
 "11281881":"درعة تافيلالت",
 "11281886":"الداخلة وادي الذهب",
 # الصومال — أسماء الولايات العربية
 "51967":"شبيلي الوسطى",
 "56083":"جوبا السفلى",
 "56084":"جوبا الوسطى",
 "51966":"شبيلي السفلى",
 "58802":"جدو",   # المصدر يسمّيها خطأً "جوبا الوسطى"
 "64982":"باكول",
 "6268943":"أودل",
 # فلسطين — محافظات بلا اسم عربي في المصدر
 "7870260":"رفح",
 "7870268":"دير البلح",
 "7870463":"بيت لحم",
 "7870654":"القدس",
 "7870657":"رام الله والبيرة",
 "7871092":"خان يونس",
 "11184609":"غزة",
 # اليمن — تصحيح أسماء ناقصة الهمز أو مغلوطة في المصدر
 "6940571":"أمانة العاصمة",
 "80425":"أبين",
 "71532":"ريمة",
 "80412":"عدن",
}

# التشكيل والتطويل، ومحارف التحكّم في اتجاه النص (LRM/RLM) التي تتسرّب من
# المصدر فتبدو الأسماء متطابقة بصرياً لكنها لا تتساوى في المقارنة والبحث.
NOISE = re.compile(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640'
                   r'\u200B-\u200F\u061C\u2066-\u2069\uFEFF]')
def strip_marks(s):
    s = NOISE.sub('', s or '')
    # ألف الوصل وهمزتا الوصل المتغيّرتان تُوحَّد إلى ألف عادية
    return s.replace('\u0671','ا').replace('\u0672','أ').replace('\u0673','إ')

PREFIXES = ["محافظة ","محافظه ","منطقة ","منطقه ","ولاية ","ولايه ","مديرية ","مديريه ",
            "إقليم ","اقليم ","عمالة ","عماله ","جهة ","جهه ","قضاء ","لواء ","بلدية ","بلديه ",
            "مركز ","قسم ","ناحية ","ناحيه ","دائرة ","إمارة ","اماره ","امارة ","إماره "]
def clean(n):
    n = strip_marks(n or '').strip()
    n = re.sub(r'\s+',' ',n)
    for p in PREFIXES:
        if n.startswith(p) and len(n) > len(p)+1:
            n = n[len(p):].strip(); break
    return n

def arabic_names(cc):
    ar={}; pref=set()
    p=f'alternatenames/{cc}.txt'
    if not os.path.exists(p): return ar
    for line in open(p,encoding='utf-8'):
        f=line.rstrip('\n').split('\t')
        if len(f)<5 or f[2]!='ar': continue
        if len(f)>7 and f[7]=='1': continue   # تاريخي
        if len(f)>6 and f[6]=='1': continue   # عامّي
        gid=f[1]; name=f[3].strip()
        if not name: continue
        if f[4]=='1': ar[gid]=name; pref.add(gid)
        elif gid not in pref: ar.setdefault(gid,name)
    ar.update(OVERRIDE)
    return ar

out=[]; stats={}; unnamed=collections.Counter()
for cc,ar_country in COUNTRIES:
    ar=arabic_names(cc)
    rows=[]
    for line in open(f'{cc}.txt',encoding='utf-8'):
        f=line.rstrip('\n').split('\t')
        rows.append(dict(gid=f[0],en=f[1],lat=float(f[4]),lng=float(f[5]),
                         fclass=f[6],fcode=f[7],a1=f[10],a2=f[11],pop=int(f[14] or 0)))
    adm1=[r for r in rows if r['fcode']=='ADM1']

    # فلسطين: المصدر يضع "الضفة الغربية" و"قطاع غزة" كمستوى أول، والمحافظات
    # الستَّ عشرة تحتهما. المستخدم يبحث عن "نابلس" لا عن "الضفة الغربية"،
    # فنرفع المستوى الثاني ليكون هو المحافظة.
    if cc == "PS":
        adm1 = [r for r in rows if r['fcode']=='ADM2']
        for r in adm1: r['a1'] = r['a1'] + '.' + r['a2']
        for r in rows:
            if r['a2']: r['a1'] = r['a1'].split('.')[0] + '.' + r['a2']
    adm2=[r for r in rows if r['fcode']=='ADM2']
    places=[r for r in rows if r['fclass']=='P']

    p_by_a1=collections.defaultdict(list)
    for r in places: p_by_a1[r['a1']].append(r)
    adm2_by_a1=collections.defaultdict(list)
    for r in adm2: adm2_by_a1[r['a1']].append(r)

    regions=[]
    for g in adm1:
        rname = clean(ar.get(g['gid'],''))
        if not rname:
            unnamed[cc]+=1
            continue
        pool = p_by_a1.get(g['a1'],[])
        seat = next((r for r in pool if r['fcode']=='PPLA'),None) \
            or next((r for r in pool if r['fcode']=='PPLC'),None)
        if seat is None and pool:
            best=max(pool,key=lambda r:r['pop'])
            seat=best if best['pop']>0 else None
        lat,lng = (seat['lat'],seat['lng']) if seat else (g['lat'],g['lng'])

        # الأماكن القابلة للاختيار داخل المحافظة:
        #   كل تقسيم إداري من المستوى الثاني + كل عاصمة إدارية + كل مدينة ≥ ٢٥ ألفاً
        cand = {}
        LATIN = re.compile(r'[A-Za-z]')
        def add(name, la, ln, pop, is_admin):
            # نستبعد ما لا اسم عربي له في المصدر: عرض حروف لاتينية في قائمة
            # عربية أسوأ من عدم عرض المكان، والمستخدم لن يبحث عنها أصلاً.
            if not name or name == rname or LATIN.search(name): return
            old = cand.get(name)
            # نفضّل الأكثر سكاناً، والتقسيم الإداري على النقطة المجرّدة
            score = (pop, 1 if not is_admin else 0)
            if old and old[3] >= score: return
            cand[name] = (round(la,4), round(ln,4), pop, score)

        for r in adm2_by_a1.get(g['a1'],[]):
            nm = clean(ar.get(r['gid'],''))
            # عاصمة المستوى الثاني إن وُجدت أدقّ من مركز المساحة
            s2 = next((p for p in pool if p['a2']==r['a2'] and p['fcode'] in ('PPLA2','PPLA','PPLC')), None)
            la,ln = (s2['lat'],s2['lng']) if s2 else (r['lat'],r['lng'])
            add(nm, la, ln, s2['pop'] if s2 else 0, True)
        for r in pool:
            if not (r['fcode'] in ('PPLC','PPLA','PPLA2','PPLA3') or r['pop']>=25000): continue
            add(clean(ar.get(r['gid'],'')), r['lat'], r['lng'], r['pop'], False)

        # تنظيف التكرار: المصدر يحمل أحياناً عدّة قيود بنفس الإحداثيات لنفس
        # المكان بأسماء بديلة مختلفة — ومنها ما يسمّي مدينة بغداد "الرصافة".
        # فنُسقط ما يطابق إحداثيات عاصمة المحافظة (المحافظة نفسها تحمله)،
        # ونُبقي من كل إحداثيات مكرّرة الاسم الأعلى سكاناً.
        seat_xy = (round(lat,4), round(lng,4))
        by_xy = {}
        for nm, v in cand.items():
            xy = (v[0], v[1])
            if xy == seat_xy: continue
            if xy in by_xy and by_xy[xy][1][3] >= v[3]: continue
            by_xy[xy] = (nm, v)
        cand = {nm: v for nm, v in by_xy.values()}

        items = sorted(cand.items(), key=lambda kv: -kv[1][2])
        # السكان بالآلاف (مُقرَّبة) — تُستعمل لترتيب البحث وترجيح الاستدلال
        # العكسي نحو المدينة المعروفة بدل حيٍّ صغير يجاورها.
        def kilo(p): return round(p/1000) if p else 0
        regions.append(dict(n=rname, lat=round(lat,4), lng=round(lng,4),
                            p=kilo(seat['pop'] if seat else 0),
                            c=[[k, v[0], v[1], kilo(v[2])] for k,v in items]))
    regions.sort(key=lambda r: r['n'])
    stats[ar_country]=(len(regions), sum(len(r['c']) for r in regions))
    out.append(dict(code=cc, name=ar_country, regions=regions))

json.dump(out, open('/tmp/geo/arab.json','w',encoding='utf-8'), ensure_ascii=False)
tr=tc=0
for k,(a,b) in stats.items():
    print(f"{k}: {a} محافظة · {b} مدينة/مديرية"); tr+=a; tc+=b
print("TOTAL:",tr,"regions,",tc,"places, size KB:",os.path.getsize('/tmp/geo/arab.json')//1024)
print("ADM1 بلا اسم عربي:",dict(unnamed) or "لا شيء")
