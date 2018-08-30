var app = angular.module('TEST', []);

app.controller('main', function($scope, eventConfig){
    $scope.enableEvents;
    $scope.selectedEventList;
    $scope.eventConfig;
        
    eventConfig.getConfig().then(function(res){
        $scope.enableEvents = $scope.eventConfig = res.data;
    })
        
    $scope.setLastEvent= function(e){        
        let result = eventConfig.setLastEvent(e);
        $scope.enableEvents = result.nextEventParsingConfig;
        $scope.selectedEventList = result.addedEvents;
        return;
    }
    $scope.popList = function(){
        eventConfig.popEvent();                
        return;
    }

})

