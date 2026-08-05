/* Gescopter Style-Block für JAChecklisteV2 (.jac2). Übernommen aus dem Prototyp
 * „Jahresabschluss-Checklisten.html", damit die Checkliste im Dashboard genauso
 * aussieht. Selbst-enthaltene helle Palette (theme-unabhängig). */
export const JAC2_CSS = `
.jac2{--bg:#eef2f7;--surface:#fff;--surface2:#f8fafc;--ink:#0f172a;--ink2:#475569;--muted:#94a3b8;
  --line:#e2e8f0;--line2:#cbd5e1;--accent:#2563eb;--accent-2:#1d4ed8;--accent-wash:#eff6ff;
  --offen:#64748b;--offen-bg:#f1f5f9;--arbeit:#2563eb;--arbeit-bg:#eff6ff;--rueck:#b45309;--rueck-bg:#fef3c7;
  --ok:#15803d;--ok-bg:#dcfce7;--korr:#b91c1c;--korr-bg:#fee2e2;--mono:ui-monospace,Menlo,Consolas,monospace;
  color:var(--ink);font-size:14px;line-height:1.5;}
.jac2 *{box-sizing:border-box}
.jac2 .mono{font-family:var(--mono)}
.jac2 button{font-family:inherit}
.jac2 .btn{display:inline-flex;align-items:center;gap:7px;padding:8px 14px;border-radius:8px;border:1px solid var(--line2);background:var(--surface);color:var(--ink);font-size:13px;font-weight:600;cursor:pointer}
.jac2 .btn:hover{border-color:var(--accent);color:var(--accent)}
.jac2 .btn-primary{background:var(--accent);color:#fff;border-color:var(--accent)}
.jac2 .btn-primary:hover{background:var(--accent-2);color:#fff}
.jac2 .btn-sm{padding:5px 10px;font-size:12px}
.jac2 .jhint{font-size:13px;color:var(--muted);line-height:1.6}
.jac2 .jhint2{font-size:12px;color:var(--muted)}

.jac2-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}
.jac2-statrow{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px}
.jac2 .kztab{max-height:360px;overflow:auto;border:1px solid var(--line);border-radius:8px}
.jac2 .kz{width:100%;border-collapse:collapse;font-size:13px}
.jac2 .kz th,.jac2 .kz td{padding:7px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:middle}
.jac2 .kz th{position:sticky;top:0;background:var(--surface2);font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);z-index:1}
.jac2 .kz .num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.jac2 .kz select{width:100%;min-width:220px;padding:5px 6px;border:1px solid var(--line2);border-radius:6px;font:inherit;font-size:12.5px;background:#fff}
.jac2 .kz tr.kz-unklar{background:#fff7ed}
.jac2 .kz tr.kz-unklar select{border-color:#f59e0b}
.jac2 .jstat{background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:10px 15px;min-width:110px}
.jac2 .jstat b{font-size:21px;display:block;font-variant-numeric:tabular-nums} .jac2 .jstat span{font-size:12px;color:var(--muted)}
.jac2 .jstat.ok b{color:var(--ok)} .jac2 .jstat.rueck b{color:var(--rueck)} .jac2 .jstat.korr b{color:var(--korr)}

.jac2 .viewnav{display:flex;gap:4px;margin:0 0 18px;border-bottom:2px solid var(--line);flex-wrap:wrap}
.jac2 .viewtab{border:none;background:none;padding:10px 16px;font:inherit;font-size:15px;font-weight:700;color:var(--ink2);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-2px;display:inline-flex;align-items:center;gap:6px}
.jac2 .viewtab .vn{font-size:11.5px;font-weight:600;opacity:.65}
.jac2 .viewtab:hover{color:var(--ink)}
.jac2 .viewtab.on.be{color:var(--ok);border-color:var(--ok)}
.jac2 .viewtab.on.ba{color:var(--korr);border-color:var(--korr)}
.jac2 .viewtab.on.aktiva{color:var(--accent);border-color:var(--accent)}
.jac2 .viewtab.on.passiva{color:#6d28d9;border-color:#6d28d9}
.jac2 .viewtab.abst{color:#0891b2} .jac2 .viewtab.on.abst{color:#0891b2;border-color:#0891b2}

.jac2 .modnav{display:flex;gap:7px;flex-wrap:wrap;margin:4px 0 14px}
.jac2 .modtab{display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line2);background:var(--surface);border-radius:9px;padding:8px 13px;font:inherit;font-size:13px;font-weight:600;color:var(--ink2);cursor:pointer}
.jac2 .modtab:hover{border-color:var(--ink2)}
.jac2 .modtab.on{background:var(--accent);border-color:var(--accent);color:#fff}
.jac2 .modtab.add{border-style:dashed;color:var(--accent)}
.jac2 .modtab .mdot{width:8px;height:8px;border-radius:50%;background:#cbd5e1;flex:0 0 auto}
.jac2 .modtab .mdot.st-arbeit{background:#f59e0b}.jac2 .modtab .mdot.st-rueck{background:#a855f7}.jac2 .modtab .mdot.st-ok{background:var(--ok)}.jac2 .modtab .mdot.st-korr{background:var(--korr)}
.jac2 .modtab.on .mdot{background:rgba(255,255,255,.85)}

.jac2 .pp{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--surface)}
.jac2 .pp__h{display:flex;align-items:center;gap:12px;padding:13px 16px}
.jac2 .pp__typ{font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.05em;border-radius:5px;padding:2px 7px;flex:none}
.jac2 .pp__typ.A{background:#f1f5f9;color:#475569}.jac2 .pp__typ.B{background:#ede9fe;color:#6d28d9}.jac2 .pp__typ.C{background:#fef3c7;color:#b45309}
.jac2 .pp__titel{font-weight:600;flex:1;font-size:14px}
.jac2 .pp__konten{display:flex;gap:5px;flex-wrap:wrap}
.jac2 .kchip{font-family:var(--mono);font-size:11px;background:var(--accent-wash);color:var(--accent-2);border-radius:5px;padding:2px 7px}
.jac2 .stpill{font-size:11.5px;font-weight:700;border-radius:99px;padding:3px 11px;flex:none}
.jac2 .st-offen{background:var(--offen-bg);color:var(--offen)}.jac2 .st-arbeit{background:var(--arbeit-bg);color:var(--arbeit)}
.jac2 .st-rueck{background:var(--rueck-bg);color:var(--rueck)}.jac2 .st-ok{background:var(--ok-bg);color:var(--ok)}.jac2 .st-korr{background:var(--korr-bg);color:var(--korr)}
.jac2 .pp__b{padding:4px 16px 18px;border-top:1px solid var(--line);background:var(--surface2)}
.jac2 .ppfoot{margin-top:14px;padding-top:12px;border-top:1px solid var(--line);text-align:right}
.jac2 .linkdel{border:none;background:none;color:var(--muted);font-size:12.5px;cursor:pointer;font-family:inherit}
.jac2 .linkdel:hover{color:var(--korr)}

.jac2 .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin-top:14px}
.jac2 .fld label{display:block;font-size:11.5px;font-weight:600;color:var(--ink2);margin-bottom:4px}
.jac2 .fld input,.jac2 .fld select,.jac2 .fld textarea{width:100%;padding:6px 10px;border:1px solid var(--line2);border-radius:7px;background:var(--surface);font:inherit;font-size:13px;color:var(--ink)}
.jac2 .fld input:focus,.jac2 .fld select:focus,.jac2 .fld textarea:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:var(--accent)}
.jac2 .fld .num,.jac2 input.num{text-align:right;font-variant-numeric:tabular-nums}
.jac2 .fld textarea{min-height:54px;resize:vertical;grid-column:1/-1}
.jac2 .full{grid-column:1/-1}
.jac2 .abw{font-weight:700;font-variant-numeric:tabular-nums}.jac2 .abw.up{color:var(--ok)}.jac2 .abw.down{color:var(--korr)}

.jac2 .quickcheck{display:flex;align-items:center;gap:10px;padding:11px 14px;margin:2px 0 14px;border:1px solid var(--line);border-radius:9px;background:var(--surface2);cursor:pointer;font-size:13.5px;font-weight:600;color:var(--ink2)}
.jac2 .quickcheck input{width:17px;height:17px;accent-color:var(--ok)}
.jac2 .quickcheck.on{background:var(--ok-bg);border-color:var(--ok);color:var(--ok)}

.jac2 .chips2{display:flex;flex-wrap:wrap;gap:8px}
.jac2 .chk{display:inline-flex;align-items:center;gap:9px;border:1px solid var(--line2);border-radius:8px;padding:8px 13px;font-size:13px;cursor:pointer;user-select:none;background:var(--surface)}
.jac2 .chk:hover{border-color:var(--accent)}
.jac2 .chk.on{background:var(--accent-wash);border-color:var(--accent);color:var(--accent-2);font-weight:600}
.jac2 .chk .bx{width:16px;height:16px;border-radius:4px;border:1.5px solid var(--line2);display:grid;place-items:center;font-size:11px;color:#fff;flex:none;font-weight:700}
.jac2 .chk.on .bx{background:var(--accent);border-color:var(--accent)}

.jac2 .posblock{margin-top:14px}.jac2 .posH{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 10px;font-weight:700}
.jac2 .posrow2{padding:7px 0;border-bottom:1px dashed var(--line)}
.jac2 .posgrid{display:flex;gap:8px;align-items:end;flex-wrap:wrap}
.jac2 .posgrid .fld{flex:1 1 180px;min-width:130px}
.jac2 .posgrid .fld.w-konto{flex:0 1 120px;min-width:90px}
.jac2 .posgrid .fld.w-num{flex:0 1 130px;min-width:95px}
.jac2 .posgrid .poscheck.inline{align-self:end;padding-bottom:8px;white-space:nowrap;font-size:12.5px}
.jac2 .posgrid .del{flex:0 0 auto;border:none;background:none;color:var(--korr);cursor:pointer;font-size:18px;padding:0 4px;align-self:center}
.jac2 .poschecks{display:flex;gap:22px;flex-wrap:wrap;margin-top:9px}
.jac2 .poscheck{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--ink2);cursor:pointer}
.jac2 .poscheck input{width:16px;height:16px;accent-color:var(--ok)}
.jac2 .poscheck.on{color:var(--ok)}
.jac2 .poscheck.warn input{accent-color:#f97316}.jac2 .poscheck.warn.on{color:#c2410c}
.jac2 .posdot{width:10px;height:10px;border-radius:50%;background:#cbd5e1;flex:0 0 auto;align-self:center;margin-right:2px}
.jac2 .posdot.ok{background:var(--ok)}.jac2 .posdot.rueck{background:#f59e0b}
.jac2 .posextra{margin-top:8px;padding-top:8px;border-top:1px dashed var(--line);display:flex;flex-wrap:wrap;align-items:center;gap:16px}
.jac2 .rowfertig{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;color:var(--ink2);cursor:pointer}
.jac2 .rowfertig input{width:15px;height:15px;accent-color:var(--ok)}.jac2 .rowfertig.on{color:var(--ok)}
.jac2 .rueckadd{border:none;background:none;color:#c2410c;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;padding:2px 0}
.jac2 .rueckadd:hover{text-decoration:underline}
.jac2 .hinweisadd{border:none;background:none;color:#2563eb;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer;padding:2px 0}
.jac2 .hinweisadd:hover{text-decoration:underline}
.jac2 .rrbadge{background:#f97316;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:700;margin-left:5px}
.jac2 .rowrueck{flex-basis:100%;display:flex;flex-direction:column;gap:5px;margin-top:2px}
.jac2 .rritem{display:flex;align-items:center;gap:8px}
.jac2 .rritem input[type=checkbox]{width:15px;height:15px;accent-color:var(--ok);flex:0 0 auto}
.jac2 .rrtext{flex:1;padding:6px 9px;border:1px solid var(--line2);border-radius:7px;font:inherit;font-size:13px;background:#fff}
.jac2 .rritem .del{border:none;background:none;color:var(--korr);cursor:pointer;font-size:16px;flex:0 0 auto}
.jac2 .rowhinweis{flex-basis:100%;display:flex;align-items:flex-start;gap:8px;margin-top:3px;background:var(--surface2);border:1px solid var(--line2);border-left:3px solid #3b82f6;border-radius:8px;padding:7px 9px}
.jac2 .rhlabel{font-size:10.5px;font-weight:700;color:#2563eb;text-transform:uppercase;letter-spacing:.05em;flex:0 0 auto;padding-top:6px}
.jac2 .rhtext{flex:1;min-height:36px;resize:vertical;padding:6px 9px;border:1px solid var(--line2);border-radius:7px;font:inherit;font-size:13px;background:#fff}
.jac2 .rowhinweis .del{border:none;background:none;color:var(--muted);cursor:pointer;font-size:16px;flex:0 0 auto}
.jac2 .addbtn{border:1px dashed var(--line2);background:none;color:var(--accent);border-radius:7px;padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;margin-top:6px}
.jac2 input.flash{outline:3px solid #f59e0b;outline-offset:1px;background:#fffbeb}

.jac2 .ergebnis{margin-top:14px;background:var(--surface);border:1px solid var(--line);border-radius:9px;padding:14px 16px}
.jac2 .ergebnis h4{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);margin:0 0 10px}
.jac2 .erow{display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--line);font-variant-numeric:tabular-nums}
.jac2 .erow:first-of-type{border-top:none}.jac2 .erow b{font-weight:700}
.jac2 .erow.total{border-top:2px solid var(--line2);margin-top:4px;padding-top:9px;font-size:15px}
.jac2 .buchung{margin-top:12px;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:12px 14px;font-family:var(--mono);font-size:12.5px}
.jac2 .buchung .bh{color:#94a3b8;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px;font-family:inherit;font-weight:700}
.jac2 .buchung .bl{display:grid;grid-template-columns:1fr auto;gap:4px 12px;padding:3px 0}
.jac2 .buchung .bl .s{color:#7dd3fc}.jac2 .buchung .bl .betr{color:#fff;font-weight:700}
.jac2 .ergHinweis{margin-top:10px;background:var(--rueck-bg);color:var(--rueck);border-radius:8px;padding:10px 13px;font-size:13px;line-height:1.5}
.jac2 .ergHinweis::before{content:"⚠ ";font-weight:700}
.jac2 .ppactions{display:flex;gap:8px;align-items:center;margin-top:14px;flex-wrap:wrap}

.jac2 .abstwrap{margin-top:2px}
.jac2 .absthead{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:10px}
.jac2 .abststat{font-size:14px}
.jac2 .abstfilters{display:flex;gap:6px}
.jac2 .abstf{border:1px solid var(--line2);background:var(--surface);border-radius:8px;padding:6px 12px;font:inherit;font-size:12.5px;font-weight:600;color:var(--ink2);cursor:pointer}
.jac2 .abstf.on{background:var(--accent);border-color:var(--accent);color:#fff}
.jac2 .abstgrp{margin-bottom:16px}.jac2 .abstgrp>h4{margin:0 0 6px;font-size:13px;font-weight:700}
.jac2 .abstrow{display:flex;align-items:center;gap:10px;padding:8px 11px;border:1px solid var(--line);border-radius:8px;margin-bottom:5px;cursor:pointer;background:var(--surface)}
.jac2 .abstrow:hover{border-color:var(--accent);background:var(--surface2)}
.jac2 .abstrow .abstic{width:18px;text-align:center;flex:0 0 auto;font-size:12px;color:var(--muted)}
.jac2 .abstrow.ok .abstic{color:var(--ok)}.jac2 .abstrow.rueck .abstic{color:#f59e0b}
.jac2 .abstrow.ok{background:var(--ok-bg);border-color:var(--ok-bg)}
.jac2 .abstk{font-weight:700;flex:0 0 auto;min-width:52px}
.jac2 .abstbez{flex:1;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jac2 .abstq{font-size:11.5px;color:var(--muted);flex:0 0 auto;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jac2 .abstgo{color:var(--muted);flex:0 0 auto;font-weight:700}

.jac2 .darkopf{display:flex;align-items:center;gap:22px;flex-wrap:wrap;padding:12px 16px;background:var(--surface2);border:1px solid var(--line);border-radius:10px;margin:10px 0 12px}
.jac2 .darkpi{display:flex;flex-direction:column}.jac2 .darkpi small{font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:700}.jac2 .darkpi b{font-size:16px;font-variant-numeric:tabular-nums}
.jac2 .darlist{display:flex;flex-direction:column;gap:10px}
.jac2 .darcard{border:1px solid var(--line2);border-radius:11px;overflow:hidden;background:#fff}
.jac2 .darcard.open{border-color:var(--accent);box-shadow:0 2px 12px rgba(37,99,235,.09)}
.jac2 .darhead{display:flex;align-items:center;gap:14px;padding:12px 15px;cursor:pointer}
.jac2 .darhead:hover{background:var(--surface2)}
.jac2 .darstat{width:11px;height:11px;border-radius:50%;flex:0 0 auto;background:var(--muted)}
.jac2 .darstat.st-offen{background:#94a3b8}.jac2 .darstat.st-arbeit{background:#f59e0b}.jac2 .darstat.st-rueck{background:#a855f7}.jac2 .darstat.st-ok{background:var(--ok)}.jac2 .darstat.st-korr{background:var(--korr)}
.jac2 .darmain{min-width:150px;flex:1;display:flex;flex-direction:column}.jac2 .darmain b{font-size:15px}.jac2 .darsub{font-size:12.5px;color:var(--ink2)}
.jac2 .darnums{display:flex;gap:20px;flex-wrap:wrap}.jac2 .darnums span{display:flex;flex-direction:column;text-align:right}.jac2 .darnums small{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700}.jac2 .darnums b{font-size:13.5px;font-variant-numeric:tabular-nums}
.jac2 .darcard .chev{transition:.15s;color:var(--muted)}.jac2 .darcard.open .chev{transform:rotate(90deg)}
.jac2 .dardetail{padding:4px 16px 16px;border-top:1px solid var(--line)}
.jac2 .darsec{margin-top:14px}.jac2 .darsec>h6{margin:0 0 8px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:700}
.jac2 .dargrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px}
.jac2 .darf{display:flex;flex-direction:column;gap:4px;font-size:12.5px;font-weight:600;color:var(--ink2)}
.jac2 .darf input,.jac2 .darf select{padding:8px 10px;border:1px solid var(--line2);border-radius:7px;font:inherit;font-size:13.5px;background:#fff}
.jac2 .darnotiz{width:100%;min-height:56px;padding:9px 11px;border:1px solid var(--line2);border-radius:8px;font:inherit;font-size:13.5px}
.jac2 .darcks{display:flex;flex-wrap:wrap;gap:8px}
.jac2 .darck{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--ink2);background:var(--surface2);border:1px solid var(--line2);border-radius:8px;padding:7px 11px;cursor:pointer}
.jac2 .darck input{accent-color:var(--ok);width:16px;height:16px}.jac2 .darck.on{background:var(--ok-bg);border-color:var(--ok);color:var(--ok)}
.jac2 .darhints{display:flex;flex-direction:column;gap:7px}
.jac2 .darhint{display:flex;gap:10px;align-items:center;justify-content:space-between;background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:8px 11px;font-size:13px}
.jac2 .darhintacts{display:flex;gap:6px;flex:0 0 auto}
.jac2 .darofrow{display:flex;gap:8px;margin-bottom:6px}.jac2 .darofrow input{flex:1;padding:7px 10px;border:1px solid var(--line2);border-radius:7px;font:inherit;font-size:13px}.jac2 .darofrow .del{border:none;background:none;color:var(--korr);cursor:pointer;font-size:17px}
.jac2 .darfoot{display:flex;align-items:center;justify-content:space-between;margin-top:16px;padding-top:12px;border-top:1px solid var(--line);flex-wrap:wrap;gap:10px}
.jac2 .darstatussel{font-size:12.5px;font-weight:600;color:var(--ink2)}.jac2 .darstatussel select{padding:6px 9px;border:1px solid var(--line2);border-radius:7px;font:inherit;margin-left:4px}

.jac2 .rfgrp{margin-bottom:20px}.jac2 .rfgrp>h4{font-size:16px;margin:0 0 2px;color:var(--ink)}
.jac2 .rfq{font-size:11px;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);font-weight:700;margin:10px 0 3px}
.jac2 .rfrow{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--line);font-size:14px}
.jac2 .rfrow input{width:17px;height:17px;accent-color:var(--ok);cursor:pointer;margin-top:1px;flex:0 0 auto}
.jac2 .rfrow.done>span{opacity:.45;text-decoration:line-through}
.jac2 .rfcopy{white-space:pre-wrap;font-family:var(--mono);font-size:12px;background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:12px;max-height:220px;overflow:auto;margin-top:10px}
.jac2 .asstext{width:100%}
.jac2 .asssum{background:#f5f3ff;border:1px solid #ddd6fe;color:#5b21b6;border-radius:8px;padding:10px 13px;font-size:13.5px;margin-bottom:14px;font-weight:700}
.jac2 .asscards{display:flex;flex-direction:column;gap:12px}
.jac2 .asscard{border:1px solid var(--line2);border-radius:11px;padding:14px 16px}
.jac2 .asscard.off{opacity:.5}
.jac2 .assinc{display:flex;align-items:center;gap:10px;cursor:pointer;flex-wrap:wrap}
.jac2 .assinc>input{width:18px;height:18px;accent-color:#7c3aed}
.jac2 .asstitle{font-weight:700;font-size:15.5px}
.jac2 .assbadge{font-size:11px;font-weight:700;padding:2px 9px;border-radius:999px;background:var(--surface2);color:var(--ink2)}
.jac2 .assbadge.be{background:var(--ok-bg);color:var(--ok)}.jac2 .assbadge.ba{background:#fef2f2;color:var(--korr)}
.jac2 .assbadge.aktiva{background:#eff6ff;color:var(--accent)}.jac2 .assbadge.passiva{background:#f5f3ff;color:#6d28d9}
.jac2 .assunvoll{font-size:11px;font-weight:700;color:#c2410c;background:#fff7ed;border:1px solid #fed7aa;border-radius:999px;padding:2px 9px}
.jac2 .assaktion{margin:9px 0 4px;font-size:14px;color:var(--ink);font-weight:600}
.jac2 .asspos{font-size:13px;color:var(--ink2);margin:3px 0}
.jac2 .asscount{display:inline-flex;align-items:center;gap:8px;font-size:13px;color:var(--ink2);margin:6px 0;font-weight:600}
.jac2 .asscount input{width:74px;padding:5px 8px;border:1px solid var(--line2);border-radius:6px;font:inherit}
.jac2 .assfehlt{font-size:12.5px;color:#c2410c;margin:6px 0}
.jac2 .assrf{margin-top:10px;padding-top:10px;border-top:1px solid var(--line)}
.jac2 .assrfh{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--muted);font-weight:700;margin-bottom:6px}
.jac2 .assrfitem{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;margin-bottom:5px;cursor:pointer}
.jac2 .assrfitem input{margin-top:2px;accent-color:var(--ok);flex:0 0 auto}
.jac2 .asskonten{margin-top:8px;display:flex;flex-direction:column;gap:2px}
.jac2-ov{position:fixed;inset:0;background:rgba(15,23,42,.5);display:flex;align-items:flex-start;justify-content:center;z-index:2000;padding:40px 16px;overflow-y:auto}
.jac2-modal{background:#fff;border-radius:14px;max-width:760px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.3);color:#0f172a}
.jac2-modal .modal__h{display:flex;align-items:center;padding:16px 22px;border-bottom:1px solid #e2e8f0}
.jac2-modal .modal__h h2{font-size:17px;margin:0}.jac2-modal .modal__h .x{margin-left:auto;border:none;background:none;font-size:22px;color:#94a3b8;cursor:pointer}
.jac2-modal .modal__b{padding:20px 22px;max-height:66vh;overflow-y:auto}
.jac2-modal .modlist{display:grid;grid-template-columns:1fr 1fr;gap:8px}
@media(max-width:600px){.jac2-modal .modlist{grid-template-columns:1fr}}
.jac2-modal .moditem{display:flex;align-items:center;gap:10px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
.jac2-modal .moditem .nm{font-weight:600;font-size:13px}.jac2-modal .moditem .ty{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:10px;color:#94a3b8}
.jac2-modal .moditem .add{margin-left:auto;border:1px solid #2563eb;color:#2563eb;background:none;border-radius:6px;padding:4px 10px;font-size:12px;font-weight:600;cursor:pointer}
.jac2-modal .moditem .add:hover{background:#2563eb;color:#fff}
.jac2-modal .moditem.on{opacity:.6}.jac2-modal .moditem .add.rem{border-color:#15803d;color:#15803d}
`
