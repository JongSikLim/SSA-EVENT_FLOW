app.factory('eventConfig', function ($http) {
    let eventConfig = null;
    let keyIndex=[];
    let lastEvent = null;
    let nextEvents = null;
    let twinStack = []; //FLAG KEY가 저장됨
    let addedEvents =[];    
    let restrict
    $http.get('./config.json').then(function(res){
        eventConfig = res.data;
        for(var i=0, event; event = res.data[i]; i++){
            keyIndex[event.EVENT_KEY] = event;
        }        
    });    
    
    return {        
        getConfig: function (){            
            return $http.get('./config.json');
        },
        getNextEvents: function () {
            return nextEvents;
        },
        setLastEvent: function (e) {                         
            addEvent(e); //데이터 삽입 관련 처리
            nextEvents = nextEventFiltering(e); //넥스트 이벤트 필터링 관련 처리
            console.log("필터링된 결과: ",nextEvents);
            console.log("TwinStack: ", twinStack);

            //리턴 데이터 rule 파싱
            nextEventParsingConfig = keyParsing(nextEvents);
            return {addedEvents, nextEventParsingConfig, twinStack};
        },
        popEvent: function(){
            let tempAddedEvents = angular.copy(addedEvents);
            addedEvents = [];
            twinStack = [];
            nextEvents = null;
            for(var i=0; i<tempAddedEvents.length-1; i++){
                this.setLastEvent(tempAddedEvents[i]);
            }            
            return {addedEvents, nextEventParsingConfig, twinStack};
        },
        getLastEvent: function () {
            return lastEvent;
        }

    }

    
    function addEvent(e){    
        lastEvent = e;                        
        TwinChecker(e);
        e.twinStack = twinStack.length;        
        addedEvents.push(e);
        return;
    }    
    //TWIN FLAG 속성인지 확인 후 속성 값 대입
    function TwinChecker(e){
        if(e.EVENT_PROPERTY== 'TWIN'){
            if(e.EVENT_TWIN_PROPERTY=='OPEN'){
                twinStack.push(e.EVENT_FLAG_KEY);
            }
            else if(e.EVENT_TWIN_PROPERTY=='CLOSE'){
                twinStack.pop()
            }
        }
        return;
    }    
    //넥스트 이벤트 리스트 계산        
    function nextEventFiltering(e) {        
        //패시브 이벤트이면 기존의 데이터 리턴        
        let necessary_next_event_list = splitString(e.NECESSARY_NEXT_EVENT_LIST);

        if(propertyFilter(e) == true){ 
            //처음에 등록되는 이벤트가 패시브 이벤트면 전체 이벤트 리스트 리턴
            if(nextEvents == null) return necessary_next_event_list;
            else return nextEvents;
        };        
        return TwinFilter(restrictFilter(necessary_next_event_list))
    }
    
    function propertyFilter(e){
        return e.EVENT_PROPERTY == 'PASSIVE'? true : false;
    }

    function restrictFilter(list) {
        //제한 요소 받아와서 배열 분리        
        let restrict_event_list = splitString(lastEvent.EVENT_RESTRICTION_LIST)
        if(restrict_event_list == null) return list;
        let lengthOfList = list.length;        

        while(lengthOfList--){
            let eventKey = list[lengthOfList];
            for(var j=0, restrictEventKey; restrictEventKey = restrict_event_list[j]; j++){
                if(eventKey == restrictEventKey){
                    console.log('삭제된 요소: ', evneyKey);
                    list.splice(lengthOfList, 1);
                }
            }
        }                
        return list;
    }

    //TWIN 교착으로 인한 에러 방지
    function TwinFilter(list) {
        let lengthOfList = list.length;        
        
        //넥스트 이벤트 전체에 대해서 타당성을 검사한다. rule에 작성된 이벤트 갯수만큼만 루프를 돌아서 과부화 노노    
        //넥스트 이벤트 리스트에서 지금 닫히면 교착현상이 발생하는 이벤트를 추출한다.
        //이벤트가 닫히는 이벤트면 트윈태그에 맨마지막 요소를 참조해서 지금 닫혀도 되는건지 아닌건지 참조한다.
        while(lengthOfList--){
            let eventKey = list[lengthOfList];
            if(keyIndex[eventKey].EVENT_TWIN_PROPERTY == 'OPEN'){                
                //이미 열려있는 이벤트를 제외시킨다.
                //전체 요소 검사
                for(var j=0; j<twinStack.length; j++){                    
                    if(twinStack[j] == keyIndex[eventKey].EVENT_FLAG_KEY){
                        console.log('이미 열려있는 이벤트: ', list[lengthOfList]);
                        list.splice(lengthOfList, 1);                        
                    }
                }
            }            
            else if(keyIndex[eventKey].EVENT_TWIN_PROPERTY == 'CLOSE'){
                //지금 닫혀도 되는 이벤트가 아닐때 리스트에서 제외한다!
                //twinStack 최상단에 Flag와 비교했을 때 다르면 제외시켜야 한다.
                if(keyIndex[eventKey].EVENT_FLAG_KEY != twinStack[twinStack.length-1]){
                    console.log('열리지 않았거나 교착상태 발생하는 이벤트: ', list[lengthOfList]);
                    list.splice(lengthOfList, 1);
                }
            }
            
            if( eventKey=="DEPARTURE_SBY" ){
                if(!(twinStack.length == 1 && twinStack[0]=="ARRIVAL_DEPARTURE")){
                    console.log('DEPARTURE SBY EXCEPTION');
                }
            }
        }
        
        //string array 반환
        return list;
    }
    

    function splitString(str){
        try {
            return str.split(',');    
        } catch (error) {
            console.log('제한 요소 없음');
            return;
        }        
        
    }
    function keyParsing(strArr){
        let nextEventParsingConfig=[];
        for(var i=0; i<strArr.length; i++){
            nextEventParsingConfig.push(keyIndex[strArr[i]]);
        }
        return nextEventParsingConfig;
    }
    function matching(strArr) {
        let result=[];
        for(var i=0, str; str = strArr[i]; i++){
            result[str] = keyIndex[str];
        }
        return result;
    }
    let 굳 =  {
        "ID": 16,
        "EVENT_KEY": "BEGIN_CARGO_WORK",
        "EVENT_NAME": "Begin cargo work",
        "EVENT_GROUP": "OTHERS",
        "EVENT_PROPERTY": "TWIN",
        "EVENT_FLAG_KEY": "CARGO_WORK",
        "EVENT_TWIN_PROPERTY": "OPEN",
        "EVENT_RESTRICTION_LIST": null,
        "NECESSARY_NEXT_EVENT_LIST": "SOUNDING_CORRECTION,NOON_MANEUVERING,BUNKERING,DEBUNKERING,NOON_IN_PORT,BEGIN_SHIFTING,END_CARGO_WORK,FIRST_DAY"
    };
})