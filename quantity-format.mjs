export function decimalInput(value){
 if(value===null||value===undefined)return '';const text=String(value);if(!/e/i.test(text))return text;
 const [mantissa,power]=text.toLowerCase().split('e'),negative=mantissa.startsWith('-'),plain=mantissa.replace('-',''),[whole,fraction='']=plain.split('.'),digits=whole+fraction,point=whole.length+Number(power);
 return (negative?'-':'')+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));
}
export function shareNumber(value){const n=Number(value);if(!Number.isFinite(n))return '–';return Math.abs(n)>0&&Math.abs(n)<1e-12?decimalInput(n).replace('.',','):n.toLocaleString('de-DE',{maximumFractionDigits:12});}
