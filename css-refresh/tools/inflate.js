/* Synchronous raw-DEFLATE decoder (RFC 1951), after zlib's puff.c. Defines window.plInflate(bytes) -> Uint8Array.
   Used by the CMS8 Embed loader so a page's layers are unpacked and applied while the page is still being read,
   before the first paint. The browser's own DecompressionStream is asynchronous and lands too late. */
window.plInflate = function (src) {
  var pos = 0, bitbuf = 0, bitcnt = 0, out = new Uint8Array(src.length * 4), n = 0;
  function need(k) { if (n + k > out.length) { var o = new Uint8Array(Math.max(out.length * 2, n + k)); o.set(out); out = o; } }
  function bits(k) {
    var v = bitbuf;
    while (bitcnt < k) { if (pos >= src.length) throw new Error('inflate: out of input'); v |= src[pos++] << bitcnt; bitcnt += 8; }
    bitbuf = v >>> k; bitcnt -= k;
    return v & ((1 << k) - 1);
  }
  function huff(lengths, off, len) {
    var count = new Uint16Array(16), sym = new Uint16Array(len), offs = new Uint16Array(16), i;
    for (i = 0; i < len; i++) count[lengths[off + i]]++;
    count[0] = 0;
    for (i = 1; i < 16; i++) offs[i] = offs[i - 1] + count[i - 1];
    for (i = 0; i < len; i++) if (lengths[off + i]) sym[offs[lengths[off + i]]++] = i;
    return { count: count, sym: sym };
  }
  function decode(h) {
    var code = 0, first = 0, index = 0, len, c;
    for (len = 1; len < 16; len++) {
      code |= bits(1);
      c = h.count[len];
      if (code - c < first) return h.sym[index + (code - first)];
      index += c; first += c; first <<= 1; code <<= 1;
    }
    throw new Error('inflate: bad code');
  }
  var LB = [3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258],
      LE = [0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0],
      DB = [1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],
      DE = [0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13],
      ORD = [16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15];
  var fixL, fixD;
  function codes(lc, dc) {
    for (;;) {
      var s = decode(lc);
      if (s < 256) { need(1); out[n++] = s; continue; }
      if (s === 256) return;
      s -= 257;
      var len = LB[s] + bits(LE[s]), d = decode(dc), dist = DB[d] + bits(DE[d]);
      if (dist > n) throw new Error('inflate: distance too far');
      need(len);
      for (var i = 0; i < len; i++, n++) out[n] = out[n - dist];
    }
  }
  var last;
  do {
    last = bits(1);
    var type = bits(2);
    if (type === 0) {
      bitbuf = 0; bitcnt = 0;
      var l = src[pos] | (src[pos + 1] << 8); pos += 4;
      need(l); out.set(src.subarray(pos, pos + l), n); n += l; pos += l;
    } else if (type === 1) {
      if (!fixL) {
        var fl = new Uint8Array(288), i;
        for (i = 0; i < 144; i++) fl[i] = 8; for (; i < 256; i++) fl[i] = 9; for (; i < 280; i++) fl[i] = 7; for (; i < 288; i++) fl[i] = 8;
        fixL = huff(fl, 0, 288);
        var fd = new Uint8Array(30); for (i = 0; i < 30; i++) fd[i] = 5;
        fixD = huff(fd, 0, 30);
      }
      codes(fixL, fixD);
    } else if (type === 2) {
      var nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4, lens = new Uint8Array(320), k;
      for (k = 0; k < ncode; k++) lens[ORD[k]] = bits(3);
      var lencode = huff(lens, 0, 19);
      lens = new Uint8Array(320);
      for (k = 0; k < nlen + ndist;) {
        var sym = decode(lencode);
        if (sym < 16) { lens[k++] = sym; continue; }
        var rep, val = 0;
        if (sym === 16) { if (!k) throw new Error('inflate: repeat with no length'); val = lens[k - 1]; rep = 3 + bits(2); }
        else if (sym === 17) rep = 3 + bits(3);
        else rep = 11 + bits(7);
        while (rep--) lens[k++] = val;
      }
      codes(huff(lens, 0, nlen), huff(lens, nlen, ndist));
    } else throw new Error('inflate: bad block type');
  } while (!last);
  return out.subarray(0, n);
};
