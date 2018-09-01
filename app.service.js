app.factory('eventConfig', function ($http) {
    let eventConfig = null;
    let keyIndex=[];
    let lastEvent = null;
    let nextEvents = null;
    let openTwinFlags = []; //FLAG KEY가 저장됨
    let addedEvents =[];    
    let restrictEvents = [];
    let restrictConfig ={};

    $http.get('https://spmsapi.azurewebsites.net/api/NOON_REPORT_EVENT_CONFIG').then(function(res){
        eventConfig = res.data;
        setFlagRestrict(eventConfig)
        for(var i=0, event; event = res.data[i]; i++){
            keyIndex[event.EVENT_KEY] = event;
        }        
    });    

    //TWIN 이벤트 중 열리는 이벤트에서 제한된 이벤트의 목록을 받아와서 플래그별 제한 이벤트 리스트 CONFIG 객체를 만드는 함수
    function setFlagRestrict(eventConfig){
        for(var i=0, event; event = eventConfig[i]; i++){
            let openEventsRestrictList=[];
            if(event.EVENT_TWIN_PROPERTY=='OPEN'){
                openEventsRestrictList = splitString(event.EVENT_RESTRICTION_LIST);                                
                restrictConfig[event.EVENT_FLAG_KEY] = openEventsRestrictList;
            }
            else if(event.EVENT_TWIN_PROPERTY=='BOTH'){
                openEventsRestrictList = splitString(event.EVENT_RESTRICTION_LIST);                                
                restrictConfig['IN_PORT'] = openEventsRestrictList;
            }            
        }
        console.log(restrictConfig)
        return;
    }
    function getRestrictEvents(flagList){        
        let result=[];
        console.log('flagList', flagList)
        for(var i=0, flag; flag=flagList[i];i++){            
            if(restrictConfig[flag]==undefined) continue;
            result =[...result,...restrictConfig[flag]];
        }        
        result = result.reduce(( a, b ) => {
            if( a.indexOf(b) < 0 ) a.push(b) ;
            return a ;
        }, []) ; // <-- 초기값 빈 배열 세팅!
        return result;
    }


    return {        
        getConfig: function (){            
            return $http.get('https://spmsapi.azurewebsites.net/api/NOON_REPORT_EVENT_CONFIG');
        },
        getNextEvents: function () {
            return nextEvents;
        },
        setLastEvent: function (e) {     
            console.clear();                    
            addEvent(e, (event)=>{
                nextEvents = nextEventFiltering(event); //넥스트 이벤트 필터링 관련 처리
            }); //데이터 삽입 관련 처리
            
            
            console.log("필터링된 결과: ",nextEvents);
            console.log("열려있는 플래그: ", openTwinFlags);
            console.log("제한된 이벤트 리스트", restrictEvents);

            //리턴 데이터 rule 파싱
            nextEventParsingConfig = keyParsing(nextEvents);
            return {addedEvents, nextEventParsingConfig, openTwinFlags};
        },
        popEvent: function(){
            let tempAddedEvents = angular.copy(addedEvents);
            
            addedEvents = [];
            openTwinFlags = [];
            restrictEvents = [];
            nextEvents = null;
            for(var i=0; i<tempAddedEvents.length-1; i++){
                this.setLastEvent(tempAddedEvents[i]);
            }            

            if(addedEvents.length == 0){
                console.log('남은 리스트가 0개 일때 전체 데이터 표시')
                nextEventParsingConfig = eventConfig                
            }
            return {addedEvents, nextEventParsingConfig, openTwinFlags};
        },
        getLastEvent: function () {
            return lastEvent;
        }

    }

    
    function addEvent(e, callback){    
        //TwinChecker 함수에서 twin이 닫혔을때 남아있는 트윈 플래크 키 중 가장 마지막 플래그의 OPEN이벤트가 
        //NEXTEVENT의 주체가 되도록 처리된 후 결과 값을 담는 변수입니다.
        let lastTwinFlag;

        lastEvent = e;                                
        lastTwinFlag = TwinChecker(e);                
        e.openTwinFlags = openTwinFlags.length;        
        addedEvents.push(e);
        callback(lastTwinFlag)
        return;
    }    

    //TWIN FLAG 속성인지 확인 후 속성 값 대입
    function TwinChecker(e){
        if(e.EVENT_PROPERTY== 'TWIN'){
            if(e.EVENT_TWIN_PROPERTY=='OPEN'){
                //플래그가 중복으로 활성화 되어 있는지 확인하는 상태변수
                let flagDuple = false;
                for(var i=0, flag; flag=openTwinFlags[i]; i++){
                    //기존에 플래그가 활성화 되어 있으면 중복으로 넣지 않는 처리
                    if(e.EVENT_FLAG_KEY == flag) flagDuple = true;                    
                }
                if(!flagDuple)
                    openTwinFlags.push(e.EVENT_FLAG_KEY)
            }            
            else if(e.EVENT_TWIN_PROPERTY=='CLOSE'){                
                let lengthOfList = openTwinFlags.length;                
                while(lengthOfList--){
                    let openFlag = openTwinFlags[lengthOfList];
                    if(openFlag == e.EVENT_FLAG_KEY){
                        console.log('트윈 플래그 닫힘: ', openFlag);
                        openTwinFlags.splice(lengthOfList, 1);
                    }
                }
                //TWINFLAG가 닫혔을 때 남아있는 TWINFLAG가 있으면, 해당 FLAG의 OPEN 이벤트를
                //다음 NEXTEVENT의 주체로 선정하는 코드입니다.
                if(openTwinFlags.length>0){
                    let prevTwinOpenEvent;
                    let lastTwinOpenFlagKey = openTwinFlags[openTwinFlags.length-1];
                    for(var i=0, event; event=eventConfig[i]; i++){
                        if(event.EVENT_FLAG_KEY == lastTwinOpenFlagKey && event.EVENT_TWIN_PROPERTY == 'OPEN'){
                            console.log('남아있는 TWIN 속성으로 인해 가장 최근에 열린 TWIN속성이 NEXTEVENT의 주체가 됩니다.');                            
                            return event;
                        }
                    }
                    nextEvents = prevTwinOpenEvent;
                }
            }

            //특수 케이스 ARRIVAL SBY는 두 가지의 키를 가진다.
            else if(e.EVENT_TWIN_PROPERTY =='BOTH'){
                let lengthOfList = openTwinFlags.length;                
                while(lengthOfList--){
                    let openFlag = openTwinFlags[lengthOfList];
                    if(openFlag == 'AT_SEA'){                 
                        console.log('ARRIVAL_SBY 특수 케이스로 AT_SEA 플래그 닫힘선언');
                        openTwinFlags.splice(lengthOfList, 1);
                    }
                }
                console.log('ARRIVAL_SBY 특수 케이스로 IN_PORT 플래그 오픈선언')
                openTwinFlags.push('IN_PORT');                
            }
        }
        return e;
    }    
    //넥스트 이벤트 리스트 계산        
    function nextEventFiltering(e) {        
        //패시브 이벤트이면 기존의 데이터 리턴        
        let necessary_next_event_list = splitString(e.NECESSARY_NEXT_EVENT_LIST);
        console.log(necessary_next_event_list)
        if(propertyFilter(e) == true){ 
            //처음에 등록되는 이벤트가 패시브 이벤트면 전체 이벤트 리스트 리턴
            if(nextEvents == null) return necessary_next_event_list;
            else return nextEvents;
        };        
        return TwinFilter(restrictFilter(necessary_next_event_list))
    }
    
    function propertyFilter(e){
        switch(e.EVENT_PROPERTY){            
            case 'PASSIVE':
                return true;                
            case 'NORMAL':
                if(openTwinFlags.length>0){                     
                    return true;                    
                };
                break;                  
        }   
        return false;                 
    }

    function restrictFilter(list) {        
        restrictEvents =getRestrictEvents(openTwinFlags);                       
        if(restrictEvents == null) return list;
        let lengthOfList = list.length;                
        while(lengthOfList--){
            let eventKey = list[lengthOfList];
            for(var j=0, restrictEventKey; restrictEventKey = restrictEvents[j]; j++){
                if(eventKey == restrictEventKey){
                    console.log('TWIN 제한에 걸려 삭제된 이벤트: ', eventKey, restrictEventKey);                    
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
        //추가 사항 
        //TWIN이 열려있을 때 NORMAL 태그도 PASSIVE와 똑같이 처리한다.

        while(lengthOfList--){
            let eventKey = list[lengthOfList];
            if(keyIndex[eventKey].EVENT_TWIN_PROPERTY == 'OPEN'){                
                //이미 열려있는 이벤트를 제외시킨다.
                //전체 요소 검사
                // for(var j=0; j<openTwinFlags.length; j++){                    
                //     if(openTwinFlags[j] == keyIndex[eventKey].EVENT_FLAG_KEY){
                //         console.log('이미 열려있는 이벤트: ', list[lengthOfList]);
                //         list.splice(lengthOfList, 1);                        
                //     }
                // }
            }            
            else if(keyIndex[eventKey].EVENT_TWIN_PROPERTY == 'CLOSE'){                
                //교착상태 관련 이슈 - 제거
                //교착 CLOSE 허용 (BEGIN_DRIFTING - DROP_ANCHOR - END_DRIFTING - HEAVE ANCHOR) 가능
                //넥스트 이벤트 리스트에서 아직 열리지 않은 이벤트 리스트를 제거한다.
                let matchFlag = false;
                for(var j=0; j<openTwinFlags.length; j++){                    
                    if(keyIndex[eventKey].EVENT_FLAG_KEY == openTwinFlags[j]){                        
                        matchFlag = true;
                    }
                }
                console.log('열리지 않은 이벤트라 제외된 CLOSE 이벤트: ', list[lengthOfList]);
                if(!matchFlag) list.splice(lengthOfList, 1);
            }
            
            if( eventKey=="DEPARTURE_SBY" ){
                if(!(openTwinFlags.length == 1 && openTwinFlags[0]=="ARRIVAL_DEPARTURE")){
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