const $ = (id) => document.getElementById(id);
const apiBase = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
  ? 'http://127.0.0.1:8787'
  : '';
let busy = false;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

async function request(path, body) {
  const options = body === undefined ? { cache: 'no-store' } : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
  let response;
  try {
    response = await fetch(`${apiBase}/api/store-management/${path}`, options);
  } catch (error) {
    console.error('Store management request failed:', error);
    throw new Error('Could not reach the store API. Check your connection and Cloudflare Access sign-in for both Store Management and its API.');
  }
  if (!(response.headers.get('Content-Type') || '').toLowerCase().includes('application/json')) {
    throw new Error('The store API returned a page instead of data. Check that the Worker is running and that you are signed in when using the live site.');
  }
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status}).`);
  return result;
}

async function refresh() {
  const { stores } = await request('stores');
  $('stores').replaceChildren();
  if (!stores.length) {
    const item = document.createElement('li');
    item.textContent = 'No MyNutrition stores found.';
    $('stores').appendChild(item);
  }
  for (const store of stores) {
    const item = document.createElement('li');
    const owners = store.members.filter((member) => member.owner).map((member) => member.email);
    const others = store.members.filter((member) => !member.owner).map((member) => member.email);
    const details = document.createElement('span');
    details.textContent = `${store.name} (${store.id}) — Owner: ${owners.join(', ') || 'unknown'}; Other access: ${others.join(', ') || 'none'}`;
    const visibility = document.createElement('button');
    visibility.type = 'button';
    visibility.className = 'visibility-button';
    visibility.textContent = store.publicSlideshow ? 'Remove from public slideshow' : 'Add to public slideshow';
    visibility.addEventListener('click', async () => {
      if (busy) return;
      const enabled = !store.publicSlideshow;
      const prompt = enabled
        ? `Make "${store.name}" visible in the public slideshow? Its store name, flavors, categories and drink names will be public.`
        : `Remove "${store.name}" from the public slideshow?`;
      if (!window.confirm(prompt)) return;
      busy = true;
      visibility.disabled = true;
      try {
        await request('public-slideshow', { storeId: store.id, enabled });
        store.publicSlideshow = enabled;
        visibility.textContent = enabled ? 'Remove from public slideshow' : 'Add to public slideshow';
        status(`"${store.name}" ${enabled ? 'added to' : 'removed from'} the public slideshow. Changes can take time to appear.`);
      } catch (error) { status(error.message, true); }
      finally { busy = false; visibility.disabled = false; }
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Delete';
    button.addEventListener('click', async () => {
      if (busy) return;
      if (!window.confirm(`Permanently delete "${store.name}" (${store.id}) and remove access for its members?\n\nThere is no automatic backup. This cannot be undone.`)) return;
      busy = true;
      button.disabled = true;
      try {
        await request('delete', { storeId: store.id });
        const message = `Deleted "${store.name}" (${store.id}).`;
        status(message);
        try { await refresh(); } catch (error) { status(`${message}\nCould not refresh: ${error.message}`, true); }
      } catch (error) { status(error.message, true); }
      finally { busy = false; button.disabled = false; }
    });
    item.appendChild(details);
    item.appendChild(visibility);
    item.appendChild(button);
    $('stores').appendChild(item);
  }
}

function storesStatus(message, error = false) {
  $('stores-status').textContent = message;
  $('stores-status').classList.toggle('error', error);
}

$('refresh').addEventListener('click', async () => {
  storesStatus('Loading stores...');
  try { await refresh(); storesStatus('Store list refreshed.'); }
  catch (error) { storesStatus(`Could not load stores: ${error.message}`, true); }
});

$('add-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  const name = $('name').value.trim();
  const owner = $('owner').value.trim();
  if (!window.confirm(`Add "${name}" for ${owner}?`)) return;
  busy = true;
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const result = await request('create', { name, owner });
    const message = `Created "${name}" for ${owner}. Store number: ${result.storeId}`;
    status(message);
    event.currentTarget.reset();
    try { await refresh(); } catch (error) { status(`${message}\nCould not refresh: ${error.message}`, true); }
  } catch (error) { status(error.message, true); }
  finally { busy = false; button.disabled = false; }
});

refresh().then(() => storesStatus('Stores loaded.'))
  .catch((error) => storesStatus(`Could not load stores: ${error.message}`, true));

let productsReady = false;
let productsBusy = false;
let productsDirty = false;
let productCategories = [];
const starterProducts = [
  {
    name: 'Peppermint Mocha Coffee',
    category: 'ingredient',
    value: 'https://www.amazon.com/Starbucks-Flavored-K-Cup-Coffee-Pods/dp/B08LKMRHQJ?th=1&linkCode=ll2&tag=shelldesignz-20&linkId=faa5fddb6064600b7b2a1c5ea0436cfa&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Vanilla Coffee Creamer',
    category: 'ingredient',
    value: 'https://www.amazon.com/dp/B0H6C95CSY?pd_rd_i=B0H6C95CSY&pd_rd_w=1beXl&content-id=amzn1.sym.17345c9b-ef8c-4a79-bcd9-8894b1e1e0ea&pf_rd_p=17345c9b-ef8c-4a79-bcd9-8894b1e1e0ea&pf_rd_r=5STD4ABEKVK5FB6PAE0C&pd_rd_wg=vdyWS&pd_rd_r=47f7b21f-3efb-4f8b-98b8-c6bc16a02120&s=grocery&sp_csd=d2lkZ2V0TmFtZT1zcF9kZXRhaWw&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=3f09f1e983f232a3476166b96504a142&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'White Chocolate',
    category: 'ingredient',
    value: 'https://www.amazon.com/gp/aw/d/B0B4BQ781T?pd_rd_plhdr=t&hsa_cr_id=0&qid=1795478888&sr=1-2-fec03104-6f11-4242-8f79-15fae2896f66&i=grocery&aref=BRdsQO5DDC&_encoding=UTF8&pd_rd_w=lvmSP&content-id=amzn1.sym.22e060df-ce87-467b-805a-61b8bd37fbe9%3Aamzn1.sym.22e060df-ce87-467b-805a-61b8bd37fbe9&pf_rd_p=22e060df-ce87-467b-805a-61b8bd37fbe9&pf_rd_r=3ZMQN6MRPVRQBAVF3KCE&pd_rd_wg=sHxEZ&pd_rd_r=77874a7f-566f-4917-84db-90df7479ca08&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=ff6b0bc909a379b94ad1947931bc5671&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Pretzels',
    category: 'ingredient',
    value: 'https://www.amazon.com/Happy-Belly-Mini-Twist-Pretzels/dp/B07RF235T3?crid=2TMBC0LVFGL3Z&dib=eyJ2IjoiMSJ9.E3_kLD3RgEh5lhdLHjpKA9h44yTYtAeei08zLGMgjWekpcsvnckz1CAQyJnJggb6Hdgd0IBZxEmionZPuKjaS8jHlkrclFz5RjWfmCiN9CNrFE5ptvoorY_YVMEi1BKbLOOjORddFOoDnnEAQxOlbKuLPYDqIMBMSCdH9E5WM97esPnTcsiM9-x-8xzIsFYLikC_sXorUlhobWbZ7tvFiGZImepXd6VnI5LVzwAUqtdIrG1xZ9p9QUhVEuAT3dcPXiN2eaTLzqrFOgSnX1LcaTldCiIbvwH1R5dABeFUOf8.9-hCYuIrERfk7B9Wm4swaM0Ey9IS8_c8l48ZtQC0rUI&dib_tag=se&keywords=pretzels&qid=1795478931&s=grocery&sprefix=pretzel%2Cgrocery%2C263&sr=1-4&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=4eaa28b8906c9145fe84f405cc69c4a2&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Rolo Family Size',
    category: 'ingredient',
    value: 'https://www.amazon.com/ROLO-Chocolate-Caramels-Candy-Family/dp/B0FTZQL4W6?crid=2MWMNC3Y61F5G&dib=eyJ2IjoiMSJ9.W_k2tdY1O6xCSw0Su3LL_1DgfFOZfQ3f_1g8l9482dsZ5y3iRAr20OltqpRj4Q8nQOi16YZVfbAsBVHUQCA-kHOQzB1h6xEbAyK-eBdR5bzRXgnFM9fmCedQgXs1bFuZ0OTYgc_MKhfX3ZWYX1Utb5PxVOOxnSA2GxVjoTO73EOdsaUO-CbzAd2bceG_orB8zaa6MOgbMvWL4UcQxC__mDAB6ubdFj60warh7HC6JEvEy9qvfqI-Zday5fSaiI2I2B_RY8pK3armJMjSqkD6U3tPAqc5Yjp_yzLFC-EaZIE.2ql22qWJST7j4-6DEPath9APgqQSt12zJ7VcmqpES9s&dib_tag=se&keywords=rolo%2Bcandy&qid=1795478966&s=grocery&sprefix=rolo%2Cgrocery%2C295&sr=1-1&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=8eea918bdb9e31b6ddbbcd6a753392ed&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Baking Dish',
    category: 'supply',
    value: 'https://www.amazon.com/Samsle-casseroles-vegetables-family-size-dishes%EF%BC%8Coven/dp/B0CG3HJLW4?dib=eyJ2IjoiMSJ9.bjFBeF7jJWmfcdUR9LiiWfaOKl3vmmxSVAJqVbVWqDTMLj7ESIFaSiO-jyV421eXh-tEfV-casnKmz-o-FiyuAMba1Yw87XkO1eMuHYdIMF1PiTuJXHcFTEJTZ28SVvTRGtvmQoNbf_3qbphbDlka7S2bKpUladRxHJpmQsaCePhF4Eq9_Pyienfg79Q2fpU08F7aarH3q1oQI4Llq_sgygIdVB3qw93dSm-GQKQdbUUFJ83kVqtZf0XBOKeGsV9qntFE94ITFpGd2AOz80JPqHLcVqGLuQrqBptTCF_iyU.geiQcnz19D5yxIJj8VAVCxusDk2aay-gHGaZn-zw6P0&dib_tag=se&keywords=christmas%2Bbaking%2Bdishes&qid=1795479009&sr=8-6&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=4ae5ec7e95ce95da65a6ef65c184ad00&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Brown Sugar',
    category: 'ingredient',
    value: 'https://www.amazon.com/Amazon-Fresh-Light-brown-sugar/dp/B0D1LC2WRY?crid=1GLMIU9HT9EVD&dib=eyJ2IjoiMSJ9.TCdN9C3vlFPDB0uH9qBc0FLVCWuyzwjol8Pvw1RE9VEWu32NXm-9FGlz90roF5DTCNqW1j2PapyiINzvGJPacjLPMvEuQqnGoCO4mZCie-WQlb5u9GwB3wkv2Q_Ka8rsa8EzKkxsWMKuCqkGEl6hf1xQhGQwyUW2BYJLLjj0GRFPqH7xonOAuijwtaSSeurpgwQDGarJDFtaVsIEGfmfoQarlB3_SqLd3qYJglZukgJv17rvCAdmc5IyhH0c0A4K6jgFdJGUbIzxhylLdwnc4-VrohSZhly29BvMhfL6-Pc.InDlkoW-siMRGVi4SXDIr4KuIcfAm5AgWapU0GMd1Xo&dib_tag=se&keywords=brown%2Bsugar&qid=1795479049&sprefix=brown%2Bsugar%2Caps%2C283&sr=8-7&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=873020a3bac29789d780f9626ba8b547&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Mixer',
    category: 'supply',
    value: 'https://www.amazon.com/gp/aw/d/B09BVCPSBT?pd_rd_plhdr=t&hsa_cr_id=0&qid=1795479085&sr=1-1-fec03104-6f11-4242-8f79-15fae2896f66&i=aps&aref=oVIcfEjQEG&_encoding=UTF8&pd_rd_w=69VyS&content-id=amzn1.sym.22e060df-ce87-467b-805a-61b8bd37fbe9%3Aamzn1.sym.22e060df-ce87-467b-805a-61b8bd37fbe9&pf_rd_p=22e060df-ce87-467b-805a-61b8bd37fbe9&pf_rd_r=88WK04HT650VEQQ41CCH&pd_rd_wg=mf9HY&pd_rd_r=655a2b5f-1bcf-47a2-af8e-1a96687a0aae&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=9cfe098e30aea076f1da0be3009d4c00&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Knives',
    category: 'supply',
    value: 'https://www.amazon.com/EVERCOOK-12-Piece-Kitchen-Stainless-Multi-Color/dp/B0H3LSHZ9P?content-id=amzn1.sym.2413d42c-7108-447f-9ab1-c239d8da6940%3Aamzn1.sym.2413d42c-7108-447f-9ab1-c239d8da6940&crid=3I73H2F1BN2IN&cv_ct_cx=knives&keywords=knives&pd_rd_i=B0H3LSHZ9P&pd_rd_r=d2473812-51d3-4dcd-8fa2-fe5112674c2f&pd_rd_w=3a9YL&pd_rd_wg=Thwkr&pf_rd_p=2413d42c-7108-447f-9ab1-c239d8da6940&pf_rd_r=TWK3ABTF26DC45G2NAAR&qid=1795479127&s=home-garden&sbo=RZvfv%2F%2FHxDF%2BO5021pAnSA%3D%3D&sprefix=knives%2Cgarden%2C361&sr=1-5-a713af6b-6e2f-439c-b0ab-a65275154d63-spons&aref=bzuRLUJYFu&sp_csd=d2lkZ2V0TmFtZT1zcF9zZWFyY2hfdGhlbWF0aWM&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=1a5453abe721bee552b3a1e5bb92d1c2&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Sugar',
    category: 'ingredient',
    value: 'https://www.amazon.com/Domino-Sugar-Cane-32-Ounce/dp/B07FTX5JC4?dib=eyJ2IjoiMSJ9.O_tCud_MrJqD2Yr0gvadxglCb1jTA2DZKKG-000Fy25naGMx1NLZvxvxa0xDmLaOeN_LIQXJN88anqcfFaWkVm1RDNfHerEo9fyaftvBlxEf-jQpgw1sA0I6yPGkovYB68iPxG_S_JUBgeSHmlqwwaLueOMn0sExlWtiXDw5G2aK4tFpOfHQTzoMn1Njt0G8Kr5HLUsGNfEA_bl7kwNZsuj37bhWTtmAHUEWWnP7vvyPwdI7-79OCjuE5fjV6E1P_b7FZ7w0IrploZaFR2GbXa3-iuZ-n8wFtMZX89ea11U.iP7SnlvPu0fdhkRtdQmxwC2T5SexYdQTvBgggoKnjmA&dib_tag=se&keywords=sugar&qid=1795479167&sr=8-26&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=43ba687cd286202a13e68f332a9453dd&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Chocolate Chips',
    category: 'ingredient',
    value: 'https://www.amazon.com/Nestle-House-Chocolate-Morsels-Ounce/dp/B00932F6BO?crid=NDQ81UPJZQXU&dib=eyJ2IjoiMSJ9.XbXEysQ9MmsyUtLtoEnyYHcehCncLBcX0xgrvVpr69iuZzqgFNbH4XxUknlPNGeGENME0gCawm8vvSIJwLy568kDx45qMxUlMn4Z4NeHw3owLIzF9ue-nRZm6LAnuHRYRPpZ8rFPTw-Dc2Ir13HUFctmWhZO6AhRNoCal5d0yqz7_ht_D-UEXiPhtFK25VbWVds88HZY6wun3guh6jwl7lB7rRjTii-PjTnmQ28i2kK9YWBcUDURlBk00nXjYNOgcVHjt0hkuln8QthIRkdaTHNBtEl2RCyEZ9T3HJ_5NN8.LO00v7vNXMpKaHS2Ge4vgKlGIcmnh2RjNCqjm8cL134&dib_tag=se&keywords=chocolate+chips&qid=1795479237&sprefix=chocolat%2Caps%2C279&sr=8-8&linkCode=ll2&tag=shelldesignz-20&linkId=fd83fbeac8d0a3d2ce7584589548429d&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Flour',
    category: 'ingredient',
    value: 'https://www.amazon.com/Amazon-Brand-Happy-Belly-Purpose/dp/B07Z78Q8TB?crid=1CD85X0TV3707&dib=eyJ2IjoiMSJ9.3uqPnceMc0w_8dLiiLed6FA-ZVu_HIrl6OFatLqzI68BYoFvhUJsW80ol6EUeOUzvEn0M637WXCo-vfv89tAIySqCBR6bJJ5RaZBqQ7EIQ4ETw9rhS97R7o6VhZJOHW0kH6lqGc0n3zWA1_eOJXAEIBk7qoJcqsaWc5Y4M9IlDbPauE_2f3SwnjTIOzNmfs6YWDEHk_jY7ZzKCYDiX3WUrJNgU7McNdUUIJ-lqls-JX1VU61x-bymnrTaBD8GN6ekyTvUJhKnXXDbS24hY8TtGnY2Arzm5RI_CqsTQPV3pU.V6nG5KkjwilqvdOmOp69q_sWhx9kJfM7su3y1UtJUHw&dib_tag=se&keywords=flour%2Ball%2Bpurpose&qid=1795479272&rdc=1&sprefix=flour%2Caps%2C300&sr=8-9&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=19163a72279870e69314f8bebcc4933f&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Baking Powder',
    category: 'ingredient',
    value: 'https://www.amazon.com/365-Everyday-Value-Baking-Powder/dp/B074H7CBXJ?crid=2Q6MHPJ678K29&dib=eyJ2IjoiMSJ9.Jem6g3tIMoVSMav17iEiECjVJH0a7aYdIkgot7Hm_q2l_OE6o9TZ5GdwHRkAAvuxs3TSbalfFNOQN2MgJxjvodRA-hGACRiJVpGpUkVtjJe4BKHPWwYF7qPLXYhBiJPQRtUyNMKJuXwlPea77TmiGEVLClClmrP84eVlFtu4BpDsaEsyL3b-ICSBUgNhgOOK26TOg22YHjomHGPNpOABc6cC1ronjMgdq7XRzKfl7x7wZ8UON8RKJmujd5hnUphePBJgrzg0wczohSEQYn554MkCvnRI5FWcVco3AXzrr8k.-etAZBP018oM_f0zRKWHsrdSxSjW_NrcEs8Dcq_Ejbc&dib_tag=se&keywords=baking%2Bpowder&qid=1795479356&sprefix=ba%2Caps%2C314&sr=8-1-spons&sp_csd=d2lkZ2V0TmFtZT1zcF9hdGY&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=724a2ca8b58cc9057349f4a724569649&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Baking Soda',
    category: 'ingredient',
    value: 'https://www.amazon.com/Amazon-Fresh-Baking-Soda-oz/dp/B09NRGMTYP?crid=36VU1F0S4EAYO&dib=eyJ2IjoiMSJ9.MODFbej0HxbHbUMICj8M9uHA8LFfZ31W9Z7C4wmPqrxt11k4sxJoO6kmylaQWypsARod1tKsmDob9uiCoU5nhhiB5mRSnq_KUBuM23PluZNBIzOFIj7B6N-6ccARslu0tahVZr1KPXNVJvWTw8y6wLGeC_CUhxPpK0oTxkksz1yTkSrTTBOdJnDz_IDVjg0i08jgducftcn-2f0cUGf45kERvVtsDtQpS2yULNXGAm7_gY1k0P7pSJr4KPIK-H8Ux-8kHyebLc20GX0qNg2C0LpXszPhGbnbvUra6UMmcB0.yjfZ5r1BjNm6Aod9DTUxXhwtB0V1My8roHP2W0eruoo&dib_tag=se&keywords=baking%2Bsoda&qid=1795479393&rdc=1&sprefix=baking%2Bsoda%2Caps%2C290&sr=8-7&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=194577ed7cdbfbb2d7f49b1c14788d07&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Vanilla Extract',
    category: 'ingredient',
    value: 'https://www.amazon.com/Amazon-Brand-Happy-Vanilla-Extract/dp/B08CYCRF2W?crid=2A2XCNELFDG77&dib=eyJ2IjoiMSJ9.wvIv1VfhI-cMqOEsZVkoOwBIiJagpNaS3gtFza1vc1JhY4IlY6I63BS352tI15nHlD_Jjhp-YtBjHNOdyWprujUDSYrW0af5F0T3dW_7C8PZ5Y7l1dzvsiNhzXrrk_8kBOGF36nR7QuLtn7PRp2gQvrP1cojh15sIfoa2_Vig6KDdbhN70TUhB1XozOOxLZfWcmezFDogNpd2tJw164KMD-rcFKhft2TFEcBv5EKWG0NzitduGaXxeMn28iwLN2-taCbnSQNcheibZfmQb6yXWWcx_G60oGMJgO-LtRfUZU.3Aqk_KzAwDFXmTWh3gmeiyKyZ1PhbhFeKdVa2VHMmeY&dib_tag=se&keywords=vanilla+extract&qid=1795479429&rdc=1&sprefix=vanilla+extrac%2Caps%2C294&sr=8-4-spons&sp_csd=d2lkZ2V0TmFtZT1zcF9hdGY&psc=1&linkCode=ll2&tag=shelldesignz-20&linkId=2d4f59116c2e9134416c9f5f79027870&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Powdered Sugar',
    category: 'ingredient',
    value: 'https://www.amazon.com/Amazon-Fresh-Powdered-sugar-lb/dp/B0D1L323BF?crid=3LHIND6D0WAH&dib=eyJ2IjoiMSJ9.HuztWPuGHDZqLbbQ4gVYoXT_oLyhY-aj0Cib9OeXpziarZ31hAbethzzwn4IyJZVFYTh8m1A9kpQL65EkyR8jof__lGx57K-QzVuBU_8k8RAbvBy8YJky0BnVkY3n5HlPPVkIGOb9dRsgX9yBdVuolH11wFsWNGvd9iE2SBAziqbBYPv5VnFQ9xI0QsOEX5IW_JZSoBa44NyoyeBEBr0tGbQzcXsy4gvWb0nVBy6EplRxog3Nv9fHLk5laL8XBtxuVKGC3HjGKn0DuJ8evkMJ3J11xa0b4jdDgnh59vepOU.wIhGZN9thDgDivrYTnFsSqulBcO1Y4WymEWYpjCNreI&dib_tag=se&keywords=powder%2Bsugar&qid=1795479465&sprefix=powder%2Bsuga%2Caps%2C284&sr=8-5&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=ddc2a7b40c6d53ffa7fef553341ac78d&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Cocoa Powder',
    category: 'ingredient',
    value: 'https://www.amazon.com/Nestle-Toll-House-Cocoa-Ounce/dp/B005CD4196?crid=1RX9SCB4YVWD&dib=eyJ2IjoiMSJ9.6o6QYZOKzxaSWrvlVUOiVoaCuqfRF5ghvM5wxenMQCBWDtLT5h78bVtR8PjvYF9oxtAs9jiGSd1LyMThtOcbhjNaXM1n-33A30aS4vEe1Hehe6Dsg2Az_GjGHiLGAL4GnwhNYnx7xGBGdiCz7okptgNAlsIiZnbt7aF3xLgB0Tk6XVsgiD6JylzT-wjeIppNF0LvtHznIk_kZbtP6_YTy5ufyv5y2l6epnUjfkFrVNHOwAbNvWxDN4DMGzfRMyJJ4OApO4D33JjPreKO1ToSC1VBdcUEYn84aXAJJTl0uBU.qXjTKgzifFbYUwisWPbReK7MFnqfNXN2tX5JtKJD1B0&dib_tag=se&keywords=cocoa%2Bpowder%2Bfor%2Bbaking&qid=1795479502&sprefix=cocoa%2Bpowder%2Caps%2C274&sr=8-6&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=aef18bbbc82e66bc4fb76d3fd99fc1a8&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Salt',
    category: 'ingredient',
    value: 'https://www.amazon.com/Morton-All-Purpose-seasoning-ingredient-easy-pour/dp/B000Q3CJGO?crid=2QI3YCSUSFBSH&dib=eyJ2IjoiMSJ9.ZuRMBiQZCtSwQUtAXjJkiJ-u3QR1uPN6tNUw2bXswAsAckEWnQ0GPYOtaj7wOKLJdGCGPVEoe74ZYUG6L7qrAkfBJ8DVmv70qSZrpsN0jVKTdFB69Q-vv1DBJBhfswiWAtJ-y5J8gWaWH1HtUsLiaQLzfb6j29a7oPRHPb_uGYBfl6q5QS-tvXvib1tZHGyMtu5YZAXCBespZTxOfwLTpeYfAVDBExJSx4RuXDFeDOoMjFN01oYPB9o-nGhRGna3vi4VTFunz5WDAkG4kHg5oI8c5hfAGeCs-ckfxzvxfb4.QSmQJ6Huy1wLxe_NLH9nNHawJP2jN74j6O_R9_eybtE&dib_tag=se&keywords=salt&qid=1795479532&sprefix=salt%2Caps%2C307&sr=8-6&linkCode=ll2&tag=shelldesignz-20&linkId=f3056985e637131cd828c6c10eeedbdb&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Walnuts',
    category: 'ingredient',
    value: 'https://www.amazon.com/gp/aw/d/B01N4KUADM?pd_rd_plhdr=t&hsa_cr_id=0&qid=1795479563&sr=1-1-fec03104-6f11-4242-8f79-15fae2896f66&i=aps&aref=znjquZWniM&_encoding=UTF8&pd_rd_w=6hRZ4&content-id=amzn1.sym.22e060df-ce87-467b-805a-61b8bd37fbe9%3Aamzn1.sym.22e060df-ce87-467b-805a-61b8bd37fbe9&pf_rd_p=22e060df-ce87-467b-805a-61b8bd37fbe9&pf_rd_r=R97D86QBVW2ZHWYXNYV9&pd_rd_wg=EJBbS&pd_rd_r=b5139d74-827a-401f-ae7c-eb0365f29336&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=e662385be3ef36f1d4fb5a48775a06a9&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Baking Sheets',
    category: 'supply',
    value: 'https://www.amazon.com/ZONGXFF-Baking-Sheet-Set-Dishwasher/dp/B0H1V8X464?crid=VHK690DYMR2I&dib=eyJ2IjoiMSJ9.RhGuVMJPnYGOmPD-okMeGN0pTsDo2C5NADa_Af5voy0pIN5dJJ2eCuiP7pLgxcOR9s7QPGJSUXWnhwVX9gPjHMNeRWUJgVeEyJ6losdkjkw0Vt5pGfrfudZ2RV7CwoTythOFFQsK68p5xoKk58wgP9bO9JQ0YZl1LlQ-j2IC7kY1MkTyx2eS8yE8LU1KLeWsBy_QM4ygydEGVy0MKCryOsgf9m3RX7UTrD4IZ0c-xWeEnWHfMa3OYKELlm1MIivj-0fnyOI1MtAZW-xcVRMlaJSa7x-foXTakyEA30ko0Gc.6GeLJ3ZT4Cscobogn4uNW-D6KHQNrOHp41lqHPN22Yk&dib_tag=se&keywords=baking%2Bsheets&qid=1795479627&sprefix=baking%2Bsheets%2Caps%2C232&sr=8-7&th=1&linkCode=ll2&tag=shelldesignz-20&linkId=6c1da7efd4e9dcb7152155ff51bd71b0&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
  {
    name: 'Measuring Cups',
    category: 'supply',
    value: 'https://www.amazon.com/Stainless-Measuring-10-Piece-Kitchen-Gadgets/dp/B091JXDLDX?crid=247ZCT3PBTNGA&dib=eyJ2IjoiMSJ9.ENcW_P6CmzVc5lO_OUnElUlokYKdAi_S7-kmzoM82gZyL944dzAttr8ZtQ2Yvjd_SDArlTikZnUJElrWYor_I1ISQydQLf8k8iA5M4SDerMV1sh9LDsaPG8toz-QFViMzFlTP0B4E26j4_47v0a0yam0WwVMdklpgNXtulCnne1vN6P_Ys1Vmep6zBNQJCASD2lgPFLtYxIcTOFTRtYlyugSmFuW32CJdltOBUdi8nMHeCQM93WTUeH-J4Fc5mieHyJW32fX5UcwjkaiUwoPii0Je9atBD80p3L-OETVfNY.jxykUBhBQnTHVrry3_x2wkPT2B9KdBWg9jQlart0wvs&dib_tag=se&keywords=measuring+cups&qid=1795479662&sprefix=measuring+cups%2Caps%2C303&sr=8-1-spons&sp_csd=d2lkZ2V0TmFtZT1zcF9hdGY&psc=1&linkCode=ll2&tag=shelldesignz-20&linkId=b65784b76c5def774ea92bc5f78aa7c4&language=en_US&gaOptInStatus=true&ref_=as_li_ss_tl',
  },
];

function productsStatus(message, error = false) {
  $('products-status').textContent = message;
  $('products-status').classList.toggle('error', error);
}

function productControls() {
  $('products-editor').disabled = productsBusy || !productsReady;
  $('add-product').disabled = productsBusy || !productsReady;
  $('add-starter-products').disabled = productsBusy || !productsReady;
  $('save-products').disabled = productsBusy || !productsReady;
  $('reload-products').disabled = productsBusy;
}

function updateProductGroups() {
  const rows = [...$('products').querySelectorAll('.product-row')];
  for (const row of rows) {
    const select = row.querySelector('[data-field="category"]');
    const selected = select.value;
    select.replaceChildren(...productCategories.map(({ id, name }) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = name;
      return option;
    }));
    select.value = productCategories.some((category) => category.id === selected) ? selected : 'uncategorized';
  }
  const sections = productCategories.map((category) => {
    const section = document.createElement('section');
    section.className = 'product-group';
    const heading = document.createElement('h3');
    heading.textContent = category.name;
    const grid = document.createElement('div');
    grid.className = 'product-grid';
    rows.filter((row) => row.querySelector('[data-field="category"]').value === category.id)
      .forEach((row) => grid.appendChild(row));
    section.append(heading, grid);
    return section;
  });
  $('products').replaceChildren(...sections);
  $('product-category-controls').replaceChildren(...productCategories.map((category) => {
    const line = document.createElement('div');
    line.className = 'product-group-actions';
    const name = document.createElement('span');
    name.textContent = category.name;
    const rename = document.createElement('button');
    rename.type = 'button';
    rename.textContent = 'Rename';
    rename.addEventListener('click', () => {
      const next = prompt('Rename category:', category.name);
      if (next === null) return;
      const trimmed = next.trim();
      if (!validProductCategoryName(trimmed, category.id)) return;
      category.name = trimmed;
      productsDirty = true;
      updateProductGroups();
    });
    line.append(name, rename);
    if (category.id.startsWith('custom-')) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.textContent = 'Remove category';
      remove.addEventListener('click', () => {
        if (!confirm(`Remove "${category.name}"? Its products will become Uncategorized.`)) return;
        productCategories = productCategories.filter((item) => item.id !== category.id);
        productsDirty = true;
        updateProductGroups();
      });
      line.append(remove);
    }
    return line;
  }));
}

function validProductCategoryName(name, previous = '') {
  if (!name || name.length > 80 || productCategories.some((category) =>
    category.id !== previous && category.name.toLowerCase() === name.toLowerCase())) {
    productsStatus('Category must be unique and between 1 and 80 characters.', true);
    return false;
  }
  if (productCategories.length >= 103 && !previous) {
    productsStatus('You can add up to 100 custom categories.', true);
    return false;
  }
  return true;
}

function addProduct(product = { name: '', value: '', category: 'uncategorized' }) {
  const row = document.createElement('div');
  row.className = 'product-row';
  for (const [field, labelText] of [['name', 'Product name'], ['value', 'Amazon affiliate URL']]) {
    const label = document.createElement('label');
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = field === 'value' ? 'url' : 'text';
    input.dataset.field = field;
    input.maxLength = field === 'value' ? 2048 : 200;
    input.value = product[field];
    input.addEventListener('input', () => { productsDirty = true; });
    label.appendChild(input);
    row.appendChild(label);
  }
  const categoryLabel = document.createElement('label');
  categoryLabel.textContent = 'Category';
  const category = document.createElement('select');
  category.dataset.field = 'category';
  for (const { id, name } of productCategories) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = name;
    category.appendChild(option);
  }
  category.value = product.category ?? 'uncategorized';
  category.addEventListener('change', () => {
    productsDirty = true;
    updateProductGroups();
    category.focus();
  });
  categoryLabel.appendChild(category);
  row.appendChild(categoryLabel);
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.addEventListener('click', () => { row.remove(); productsDirty = true; });
  row.appendChild(remove);
  $('products').appendChild(row);
  return row;
}

async function loadProducts() {
  productsBusy = true;
  productControls();
  try {
    const result = await request('shop-products');
    if (!Array.isArray(result.categories) || result.categories.some((category) =>
      !category || typeof category.id !== 'string' || typeof category.name !== 'string') ||
      !Array.isArray(result.products) || result.products.some((product) =>
      !product || typeof product.name !== 'string' || typeof product.value !== 'string' ||
      !result.categories.some((category) => category.id === (product.category ?? 'uncategorized')))) {
      throw new Error('The shop product response is invalid.');
    }
    productCategories = result.categories;
    $('products').replaceChildren();
    result.products.forEach(addProduct);
    updateProductGroups();
    productsReady = true;
    productsDirty = false;
    productsStatus('Products loaded.');
  } catch (error) {
    productsStatus(`Could not load products: ${error.message}`, true);
  } finally {
    productsBusy = false;
    productControls();
  }
}

$('add-product').addEventListener('click', () => {
  const row = addProduct();
  productsDirty = true;
  updateProductGroups();
  row.querySelector('input').focus();
});
$('add-starter-products').addEventListener('click', () => {
  const existing = new Set([...$('products').querySelectorAll('[data-field="value"]')]
    .map((input) => input.value.trim()));
  const additions = starterProducts.filter((product) => !existing.has(product.value));
  additions.forEach(addProduct);
  updateProductGroups();
  if (additions.length) productsDirty = true;
  productsStatus(additions.length
    ? 'Starter products added. Select Save products to publish them.'
    : 'All starter products are already in the list.');
});
$('reload-products').addEventListener('click', () => {
  if (productsDirty && !confirm('Discard unsaved product changes and reload?')) return;
  loadProducts();
});
$('save-products').addEventListener('click', async () => {
  const products = [...$('products').querySelectorAll('.product-row')].map((row) => ({
    name: row.querySelector('[data-field="name"]').value.trim(),
    value: row.querySelector('[data-field="value"]').value.trim(),
    category: row.querySelector('[data-field="category"]').value,
  }));
  if (products.some((product) => !product.name || !product.value)) {
    productsStatus('Every product needs a name and Amazon URL.', true);
    return;
  }
  productsBusy = true;
  productControls();
  try {
    await request('shop-products', { products, categories: productCategories });
    productsDirty = false;
    productsStatus('Products saved. Changes may take time to appear on the public shop.');
  } catch (error) {
    productsStatus(`Could not save products: ${error.message}`, true);
  } finally {
    productsBusy = false;
    productControls();
  }
});

$('add-product-category').addEventListener('click', () => {
  const name = prompt('New category name:');
  if (name === null) return;
  const trimmed = name.trim();
  if (!validProductCategoryName(trimmed)) return;
  productCategories.push({ id: `custom-${crypto.randomUUID()}`, name: trimmed });
  productsDirty = true;
  updateProductGroups();
  productsStatus('Category added. Select Save products to save changes.');
});

loadProducts();
