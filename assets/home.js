// Home: open "See more" when a link targets something inside it; close NFTs menu after a pick.
(function(){
  function go(){var h=location.hash.slice(1);if(!h)return;var t=document.getElementById(h),m=document.getElementById('more');if(t&&m&&m.contains(t)){m.open=true;t.scrollIntoView();}}
  window.addEventListener('hashchange',go);go();
  document.querySelectorAll('.navdd a').forEach(function(a){a.addEventListener('click',function(){a.closest('details').open=false;setTimeout(go,0);});});
  document.addEventListener('click',function(e){document.querySelectorAll('.navdd[open]').forEach(function(d){if(!d.contains(e.target))d.open=false;});});
})();
