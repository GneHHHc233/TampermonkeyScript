// ==UserScript==
// @name         huobi-子账户历史资产
// @namespace    http://tampermonkey.net/
// @version      0.4.6
// @license      MPL-2.0
// @description  记录并绘制子账户历史资产
// @author       C4r
// @match        https://account.huobi.com/zh-cn/subaccount/management/
// @grant        GM_addStyle
// @grant        GM_getResourceText
// @grant        GM_getResourceURL
// @require      https://cdn.jsdelivr.net/npm/jquery@3.5.0/dist/jquery.min.js
// @require      https://cdn.jsdelivr.net/npm/moment@2.24.0/min/moment.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.9.4/Chart.min.js
// @resource     w3CSS https://www.w3schools.com/w3css/4/w3.css
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle('\
.flex-container {\
    width: 95%;\
    margin: 0 auto;   \
    display: flex;\
    flex-direction: column;\
}\
.flex-container .full-row {\
    width: 100%;\
}\
.flex-container .row {\
    width: 100%;\
    display: flex;\
}\
.flex-container .column {\
    width: 50%;\
}');
    $("head").append("<style>" + GM_getResourceText("w3CSS") + "</style>");

    let storageName = 'C4rHuobiSubAsset'

    function httpGetAsync(theUrl, callback) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function () {
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
                callback(xmlHttp.responseText);
        }
        xmlHttp.open("GET", theUrl, true); 
        xmlHttp.send(null);
    }


    function dataToChartData(data) {
        
        let timeSort = Object.keys(data).sort()

        let xArray = []

        let y1Array = []

        let y2Array = []

        for (let time of timeSort) {
            // xyArray.push({ x: Math.round((time - minTime) / timeStep), y: (data[time]) })

            
            xArray.push(new Date(parseInt(time)))
            y1Array.push((data[time]['asset']))
            y2Array.push((data[time]['convAsset']))
        }

        return {
            'xArray': xArray,
            'y1Array':y1Array,
            'y2Array':y2Array
        }
    }

    /**
     * return level by reading page
     */
    function getAssetHTML() {


        if($('div.assets').length > 0 && $('.icon-loading').is(":hidden")){
            let valAsset =  parseFloat($.trim($('div.assets span:not(.convert)').text()).split('\n')[0])

            let valConvAsset = parseFloat($.trim($('div.assets span.convert').text()).split('\n')[0].substring(1))

            // console.log($('#tab-transfer'))
            // console.log($('div.assets span:not(.convert)').text(), {'asset':valAsset, 'convAsset':valConvAsset})
            if(valAsset == 0. || valConvAsset == 0.){
                return undefined
            }else{
                return {'asset':valAsset, 'convAsset':valConvAsset}
            }
            
        }else{
            return undefined
        }

        

    }


    function getData(storageName, api_key=undefined) {

        return new Promise((resolve,reject)=>{
            let dataStr = localStorage.getItem(storageName)

            let data = {}
            if (dataStr !== null && dataStr !== undefined && dataStr.trim() !== '') {
                data = JSON.parse(dataStr)
            }
    
            let api_key_local = undefined
            if(data['key'] && data['key']  !== undefined && data['key'].trim() !== ''){
                api_key_local = data['key']
            }
    
            
            if(api_key || api_key_local){ 
                $.ajaxSetup({
                    headers:{
                       'secret-key': (api_key == undefined ? api_key_local : api_key) 
                    }
                });
                $.getJSON( "https://api.jsonbin.io/b/"+storageName, function( dataReq ) {
                    if(dataReq['data'] && dataReq['data']  !== undefined && dataReq['data'].trim() !== ''){
                        data['data'] = {...data['data'], ...dataReq['data']}
                        resolve(data)
                    }
                });
            }else{
                resolve(data)
            }
        })
 
    }

    function storeData(storageName, data, api_key=undefined){

        return new Promise((resolve,reject)=>{
            localStorage.setItem(storageName, JSON.stringify(data))

            let api_key_local = undefined
            if(data['key'] && data['key']  != undefined && data['key']  != {} && data['key'].trim() != ''){
                api_key_local = data['key']
            }
            if(api_key || api_key_local){
                let req = new XMLHttpRequest();

                req.onreadystatechange = () => {
                  if (req.readyState == XMLHttpRequest.DONE) {
                    console.log(req.responseText);
                    resolve()
                  }
                };
                
                req.open("POST", "https://api.jsonbin.io/b/"+storageName, true);
                req.setRequestHeader("Content-Type", "application/json");
                req.setRequestHeader("secret-key", api_key);
                req.send(data);
            }
        })

    }


    /**
     * 
     * @param {*} cAsset {'asset':valAsset, 'convAsset':valConvAsset}
     * @returns data { date:{'asset':valAsset, 'convAsset':valConvAsset}}
     */
    function updateData(cAsset) {

        return new Promise((resolve, reject)=>{
            let cDate = new Date()


            let api_key = undefined
            if($('#sync-key') && $('#sync-key').val() && $('#sync-key').val().trim() != ''){
                api_key = $('#sync-key').val().trim()
            }
    
            getData(storageName, api_key).then(data =>{
                
                let isStore = true
                console.log(data, data['data'])
                if(data['data'] && Object.keys(data['data']).length > 0 ){
                    let timeSort = Object.keys(data['data']).sort()
                    let lastTime = timeSort[timeSort.length - 1]
                    let lastAsset = data['data'][lastTime]
        
                    if (Math.abs(lastAsset['convAsset'] - cAsset['convAsset']) > 100 ) {
        
                        data['data'][cDate.getTime()] = cAsset

                    }else if(cDate.getTime() - lastTime > 1000*60*60*24){
                        data['data'][cDate.getTime()] = cAsset
        
                    }else{
                        data['data'][cDate.getTime()] = cAsset
                        isStore = false
                    }
                }else{
                    // initial log file 
                    data['data'] = {}
                    data['key'] = undefined
                    data['data'][cDate.getTime()] = cAsset
                }

                if(isStore){
                    storeData(storageName, data, api_key).then(()=>{

                    })
                }

                resolve(data)

            })
    
    
        })

    }


    /**
     * 画图
     * @param {*} ctx element in Page
     * @param {*} data data 
     * @returns myChart
     */
    function plotAssetDetail(ctx, data) {

        let chartData = dataToChartData(data)
        // console.log('c4r zhihu level chartData :', chartData)
        // console.log(Math.max(chartData['y1Array']), Math.max(chartData['y2Array']))

        var myChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: chartData['xArray'],
              datasets: [{
                label: 'BTC',
                yAxisID: 'A',
                data: chartData['y1Array'],
                backgroundColor: 'rgba(123, 83, 252, 0.8)',
                borderColor: 'rgba(33, 232, 234, 1)',
                borderWidth: 1,
                fill: false,
                showLine: true,
              }, {
                label: 'CNY',
                yAxisID: 'B',
                data: chartData['y2Array'],
                backgroundColor: 'red',
                borderColor: 'red',
                borderWidth: 1,
                fill: false,
                showLine: true
              }]
            },
            options: {
                responsive:true,
                maintainAspectRatio: false,
                title: {
                    display: false,
                    text: '子账户资产',
                },
                legend: {
                    display: false
                },
                scales: {
                    xAxes: [{
                        type: 'time',
                        time: {
                            unit: 'day',
                            displayFormats: {
                                week: 'YY.M.D'
                            }
                        }
                    }],
                    yAxes: [{
                        id: 'A',
                        type: 'linear',
                        position: 'left',
                        ticks: {
                            beginAtZero: true
                            },
                        scaleLabel: {
                            display: true,
                            labelString : 'BTC',
                            fontColor: 'blue'
                        },
                        ticks: {
                            max: Math.max(...chartData['y1Array'])*1.2,
                            min: Math.min(...chartData['y1Array'])*0.9,
                            fontColor: 'blue'
                        }
                    },{
                        id: 'B',
                        type: 'linear',
                        position: 'right',
                        ticks: {
                            beginAtZero: true
                            },
                        scaleLabel: {
                            display: true,
                            labelString : 'CYN',
                            fontColor: 'red'
                        },
                        ticks: {
                            max: Math.max(...chartData['y2Array'])*1.1,
                            min: Math.min(...chartData['y2Array'])*0.9,
                            fontColor: 'red'
                        },
                        gridLines: {
                            drawOnChartArea: false,
                          },
                    }]
                }
            }
        });

        return myChart
    }


    function isAssetDetailShown() {
        return $('.subaccount-assets[assetDetail]').length > 0
    }

    function addAssetDetailTag() {
        // add tag
        $('.subaccount-assets').attr('assetDetail', '')
    }

    function isSubAssetPage(){
        return $('.subaccount-assets').length > 0 
    }


    function showAsset() {

        if (isAssetDetailShown() || !isSubAssetPage()) {
            return
        }

        let cAsset = getAssetHTML()
        if (cAsset == undefined) return

        addAssetDetailTag()

        updateData(cAsset).then(data =>{

            $('\
            <div class="flex-container" >\
                <div class="row">\
                    <div class="column" style="width:80%"><canvas id="assetDetailChart"></canvas></div>\
                    <div class="column" style="width:20%">\
                        <div class="flex-container" id="sync">\
                            <label class="full-row" for="key"><a href="https://jsonbin.io/api-keys" target="_blank">JSONBIN.io key:</a></label>\
                            <textarea class="full-row" type="text" id="sync-key" name="key"></textarea>\
                            <div class="full-row">\
                            <button type="button" class="w3-btn w3-white w3-border w3-border-green w3-round-xlarge">\
                                同步\
                            </button>\
                        </div>\
                        </div>\
                    </div>\
                </div>\
            </div>').insertAfter('.subaccount-assets')
                    let ctx = document.getElementById("assetDetailChart");
            
                    plotAssetDetail(ctx, data['data'])
        })


    }


    function callbackAsset() {
        // console.log('found Level bar')
        showAsset()
    }

    // ===============================================
    // if (isSubAssetPage()) {
    showAsset()
    $(document).ready(() => {

        let observerLevel = new MutationObserver(callbackAsset)

        observerLevel.observe($('body').get(0),
            {
                subtree: true, childList: true, characterData: true, attributes: true,
                attributeFilter: ['.subaccount-assets'],
                attributeOldValue: false, characterDataOldValue: false
            })

        // debug
        // let debugData = {
        //     1580511600000: 3.00,
        //     1577833200000: 2.10,
        //     1585692000000: 3.24
        // }
        // localStorage.setItem(storageName, JSON.stringify(debugData))

        showAsset()
    })
    // }

})();