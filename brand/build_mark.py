import math, sys
CX, CY = 55, 46          # centre of the coffee surface
RX, RY = 31, 16.5      # coffee surface ellipse (perspective)
coffee="#b47c52"; milk="#fbf6ee"; cup="#5b7a6a"; cupdark="#4b6758"; saucer="#6f8d7e"; saucer_dk="#587466"; rim="#f6efe4"

def track_points(offset, phase, amp=0.24, waves=1.5, angle=-22):
    # a ski track on the flat (unit-circle) surface, then rotated and squashed into perspective
    pts=[]
    a=math.radians(angle)
    for i in range(0,161):
        t=-1.15+2.3*i/160                      # along the fall line
        x=offset+amp*math.sin(math.pi*waves*t+phase)
        y=t
        xr=x*math.cos(a)-y*math.sin(a); yr=x*math.sin(a)+y*math.cos(a)
        pts.append((CX+xr*RX, CY+yr*RY))
    return "M"+" L".join(f"{x:.2f} {y:.2f}" for x,y in pts)

def mark(bg=True):
    t1=track_points(-0.2,0); t2=track_points(0.24,0)
    def tr(d): return f'<path d="{d}" stroke="{milk}" stroke-width="5.2"/><path d="{d}" stroke="{coffee}" stroke-width="1.9"/>'
    return f'''{'<rect width="120" height="120" rx="26" fill="#f4ede3"/>' if bg else ''}
  <!-- handle -->
  <path d="M89 52 C 106 50, 107 74, 85 72" fill="none" stroke="{cup}" stroke-width="6" stroke-linecap="round"/>
  <!-- cup body -->
  <path d="M{CX-34} {CY} C {CX-34} {CY+28}, {CX-18} {CY+44}, {CX} {CY+44} C {CX+18} {CY+44}, {CX+34} {CY+28}, {CX+34} {CY} Z" fill="{cup}"/>
  <!-- rim + coffee -->
  <ellipse cx="{CX}" cy="{CY}" rx="34" ry="{RY+2.6:.1f}" fill="{rim}"/>
  <ellipse cx="{CX}" cy="{CY}" rx="{RX}" ry="{RY}" fill="{coffee}"/>
  <clipPath id="dd-coffee"><ellipse cx="{CX}" cy="{CY}" rx="{RX-1.5}" ry="{RY-0.8}"/></clipPath>
  <!-- latte art: two skiers' tracks poured in milk, weaving figure-eights -->
  <g clip-path="url(#dd-coffee)" fill="none" stroke-linecap="round" stroke-linejoin="round">{tr(t1)}{tr(t2)}</g>
'''
if __name__=="__main__":
    open(sys.argv[1],'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">\n  {mark()}</svg>\n')
