import json,unicodedata,math,sys
fm=json.loads(sys.stdin.read())
def norm(s): return unicodedata.normalize('NFKD',s).encode('ascii','ignore').decode().lower().replace("'","").replace('’','')
S=[json.loads(l) for l in open('data/storico_partite.jsonl')]
rows=[]
for part,txt in fm:
    st=[s for s in S if norm(s['partita'].split(' - ')[0])[:4]==norm(part.split(' - ')[0])[:4]]
    if not st: print('nomatch',part); continue
    G=st[0]['giocatori']
    for t in txt.split(';'):
        n,p,y=t.split('|'); sur=norm(n).split()[-1]
        c=[g for g in G if norm(g['n']).split()[-1]==sur or sur in norm(g['n'])]
        if len(c)!=1: print('?',part,n,[g['n'] for g in c]); continue
        rows.append((part,n,float(p),c[0]['p'],int(y),c[0]['ammonito']))
print(len(rows))
dis=[r for r in rows if r[4]!=r[5]]; print('discordanze esito',dis)
def ll(ps,ys): return -sum(y*math.log(p)+(1-y)*math.log(1-p) for p,y in zip(ps,ys))/len(ys)
def auc(ps,ys):
    pos=[p for p,y in zip(ps,ys) if y]; neg=[p for p,y in zip(ps,ys) if not y]
    return sum((a>b)+.5*(a==b) for a in pos for b in neg)/len(pos)/len(neg)
ys=[r[4] for r in rows]; A=[r[3] for r in rows]; F=[r[2] for r in rows]
lg=lambda p:math.log(p/(1-p)); E=[1/(1+math.exp(-(lg(a)+lg(f))/2)) for a,f in zip(A,F)]
for nm,P in [('app',A),('fotmob',F),('media',E)]:
    t3=0
    for part in set(r[0] for r in rows):
        idx=[i for i,r in enumerate(rows) if r[0]==part]; idx.sort(key=lambda i:-P[i]); t3+=sum(ys[i] for i in idx[:3])
    print(nm,'somma p',round(sum(P),1),'gialli',sum(ys),'ll',round(ll(P,ys),4),'auc',round(auc(P,ys),3),'top3',t3)
