window.IQDATA = {
  rows: [
    {b:'16', bd:'10 Sep', bdesc:'Card — Fuel Direct', bamt:'(85.00)', l:'JE-4405', ldesc:'Fuel Direct card', lamt:'(85.00)', res:'Matched', k:'ok'},
    {b:'17', bd:'11 Sep', bdesc:'Transfer in — Pell & Co', bamt:'240.00', l:'JE-4408', ldesc:'Receipt Pell & Co', lamt:'240.00', res:'Matched', k:'ok'},
    {b:'18', bd:'12 Sep', bdesc:'Transfer in — Arden Retail RCP-2291', bamt:'500.00', l:'JE-4410', ldesc:'Receipt Arden Retail INV-8812', lamt:'500.00', res:'Matched', k:'ok', r1:true},
    {b:'19', bd:'13 Sep', bdesc:'Transfer in — Arden Retail RCP-2291', bamt:'500.00', l:'—', ldesc:'No ledger entry', lamt:'', res:'R1 · possible duplicate', k:'r', r1:true},
    {b:'20', bd:'15 Sep', bdesc:'Direct debit — Citypower', bamt:'(120.00)', l:'JE-4412', ldesc:'Citypower direct debit', lamt:'(120.00)', res:'Matched', k:'ok'},
    {b:'24', bd:'17 Sep', bdesc:'Payment — Kestrel Supplies', bamt:'(1,200.00)', l:'JE-4431', ldesc:'Kestrel Supplies INV-K552', lamt:'(1,250.00)', res:'R2 · differs by 50', k:'r'},
    {b:'29', bd:'21 Sep', bdesc:'Transfer in — Solway Logistics TRF-0921', bamt:'300.00', l:'—', ldesc:'No ledger entry', lamt:'', res:'R3 · bank only', k:'r'},
    {b:'—', bd:'', bdesc:'Not on statement', bamt:'', l:'JE-4479', ldesc:'Receipt Harbour Foods, 30 Sep', lamt:'700.00', res:'R4 · ledger only', k:'r'}
  ],
  items: [
    {id:'R1', label:'Second Arden Retail transfer, same reference', amt:'500.00', who:'Duplicate check', status:'suggested'},
    {id:'R2', label:'Kestrel Supplies paid 50 less than recorded', amt:'50.00', who:'Payment difference', status:'investigating'},
    {id:'R3', label:'Solway Logistics receipt not in the ledger', amt:'300.00', who:'Bank-only receipt', status:'open'},
    {id:'R4', label:'Harbour Foods receipt not yet on the statement', amt:'700.00', who:'Subsequent clearance', status:'evidence'}
  ],
  autos: [
    {id:'rate', name:'Interest rate change review', ws:'Kijani Microfinance', trig:'When a loan rate changes in core banking', last:'25 Oct, 16:20', status:'Needs review', kind:'attn'},
    {id:'cash', name:'Payroll account reconciliation', ws:'Meridian Freight', trig:'3rd business day of each month, 07:00', last:'5 Oct, 07:00', status:'No exceptions', kind:'ok'},
    {id:'priv', name:'New privileged accounts', ws:'Kijani Microfinance', trig:'When an admin role is granted', last:'24 Oct, 09:12', status:'2 accounts verified', kind:'ok'},
    {id:'je', name:'Late journals over 25,000', ws:'Meridian Freight', trig:'Mondays, 07:00', last:'20 Oct, 07:00', status:'No exceptions', kind:'ok'}
  ]
};
